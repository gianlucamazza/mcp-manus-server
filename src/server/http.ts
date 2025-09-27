import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import { registerMetricsMiddleware } from '../monitoring/middleware.js';
import { registerMonitoringRoutes } from '../monitoring/routes.js';
import { registerDiscoveryRoutes } from './discovery-routes.js';
import { 
  logger, 
  runWithCorrelation, 
  generateCorrelationId, 
  generateRequestId,
  logHTTPRequest,
  logError 
} from '../utils/logger.js';
import { configManager } from '../utils/config.js';
import { secretsManager } from '../utils/secrets.js';
import { metricsCollector } from '../monitoring/metrics.js';

export class HTTPServer {
  private fastify: FastifyInstance;
  private config: ReturnType<typeof configManager.getConfig>;

  constructor() {
    this.config = configManager.getConfig();
    this.fastify = Fastify({
      logger: false, // Use our custom logger
      trustProxy: true,
      disableRequestLogging: true,
      keepAliveTimeout: this.config.KEEP_ALIVE_TIMEOUT,
      connectionTimeout: this.config.HEADERS_TIMEOUT
    });

    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
  }

  private async setupMiddleware(): Promise<void> {
    // Security middleware
    await this.fastify.register(helmet, {
      contentSecurityPolicy: {
        directives: this.config.CSP_DIRECTIVES ? {
          defaultSrc: ["'self'"],
          ...this.parseCspDirectives(this.config.CSP_DIRECTIVES)
        } : false
      },
      hsts: {
        maxAge: this.config.HSTS_MAX_AGE,
        includeSubDomains: this.config.HSTS_INCLUDE_SUBDOMAINS,
        preload: this.config.HSTS_PRELOAD
      }
    });

    // CORS middleware
    await this.fastify.register(cors, {
      origin: this.config.CORS_ORIGIN === '*' ? true : configManager.getCorsOrigins(),
      credentials: this.config.CORS_CREDENTIALS,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
    });

    // Metrics middleware
    await registerMetricsMiddleware(this.fastify, {
      enableDefaultMetrics: this.config.METRICS_ENABLED,
      skipRoutes: ['/health', '/ready', '/metrics'],
      normalizeRoutes: true
    });

    // Enhanced correlation middleware
    this.fastify.addHook('onRequest', async (request, reply) => {
      const correlationId = request.headers['x-correlation-id'] as string || generateCorrelationId();
      const requestId = request.headers['x-request-id'] as string || generateRequestId();
      const sessionId = request.headers['x-session-id'] as string;
      const traceId = request.headers['x-trace-id'] as string;
      
      // Set correlation context for the request
      runWithCorrelation({
        correlationId,
        requestId,
        sessionId,
        traceId
      }, () => {
        (request as any).correlationId = correlationId;
        (request as any).requestId = requestId;
        (request as any).sessionId = sessionId;
        (request as any).traceId = traceId;
      });
      
      // Set response headers
      reply.header('x-correlation-id', correlationId);
      reply.header('x-request-id', requestId);
      if (traceId) reply.header('x-trace-id', traceId);
    });

    // Enhanced logging middleware with correlation
    this.fastify.addHook('onResponse', async (request, reply) => {
      const responseTime = reply.getResponseTime();
      const correlationId = (request as any).correlationId;
      const requestId = (request as any).requestId;
      const sessionId = (request as any).sessionId;
      const traceId = (request as any).traceId;
      
      // Log with correlation context
      runWithCorrelation({
        correlationId,
        requestId,
        sessionId,
        traceId
      }, () => {
        logHTTPRequest(
          request.method,
          request.url,
          reply.statusCode,
          responseTime,
          {
            userAgent: request.headers['user-agent'],
            ip: request.ip,
            contentType: reply.getHeader('content-type'),
            contentLength: reply.getHeader('content-length')
          }
        );
      });
    });
  }

  private async setupRoutes(): Promise<void> {
    // Root endpoint
    this.fastify.get('/', async (request, reply) => {
      reply.send({
        name: 'MCP Manus Server',
        version: '1.0.0',
        description: 'Model Context Protocol server with Manus.im integration',
        status: 'running',
        timestamp: new Date().toISOString(),
        environment: this.config.NODE_ENV,
        capabilities: {
          mcp: ['resources', 'tools'],
          oauth: ['authorization_code', 'pkce'],
          monitoring: ['prometheus', 'health_checks'],
          security: ['secrets_management', 'secure_headers']
        }
      });
    });

    // Register monitoring routes
    await registerMonitoringRoutes(this.fastify);

    // Register OAuth discovery routes
    await registerDiscoveryRoutes(this.fastify);

    // 404 handler
    this.fastify.setNotFoundHandler(async (request, reply) => {
      reply.code(404).send({
        error: 'Not Found',
        message: `Route ${request.method} ${request.url} not found`,
        timestamp: new Date().toISOString()
      });
    });
  }

  private setupErrorHandling(): void {
    this.fastify.setErrorHandler(async (error, request, reply) => {
      const correlationId = (request as any).correlationId;
      const requestId = (request as any).requestId;
      const sessionId = (request as any).sessionId;
      const traceId = (request as any).traceId;
      
      // Log error with correlation context
      runWithCorrelation({
        correlationId,
        requestId,
        sessionId,
        traceId
      }, () => {
        logError(error, 'http_request', {
          method: request.method,
          url: request.url,
          statusCode: error.statusCode || 500,
          userAgent: request.headers['user-agent'],
          ip: request.ip
        });
      });

      // Don't expose internal errors in production
      const isDevelopment = this.config.NODE_ENV === 'development';
      
      reply.code(error.statusCode || 500).send({
        error: error.statusCode < 500 ? error.message : 'Internal Server Error',
        ...(isDevelopment && { 
          stack: error.stack,
          details: error 
        }),
        correlationId,
        requestId,
        timestamp: new Date().toISOString()
      });
    });

    // Graceful shutdown
    const gracefulShutdown = async (signal: string) => {
      logger.info(`Received ${signal}, shutting down HTTP server gracefully...`);
      
      try {
        await this.fastify.close();
        logger.info('HTTP server closed successfully');
        process.exit(0);
      } catch (error) {
        logger.error('Error during HTTP server shutdown:', error);
        process.exit(1);
      }
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  }

  public async start(): Promise<void> {
    try {
      // Update secrets and config status in metrics
      const secretsValidation = secretsManager.validateSecrets();
      const configValidation = configManager.validateSecrets();
      
      metricsCollector.updateConfigValidationStatus(
        this.config.NODE_ENV, 
        configValidation.valid
      );

      // Update individual secret status
      const secretsStatus = secretsManager.getSecretsStatus();
      Object.entries(secretsStatus).forEach(([name, status]) => {
        metricsCollector.updateSecretsStatus(name, status.source, status.loaded);
      });

      const address = await this.fastify.listen({
        port: this.config.PORT,
        host: this.config.HOST
      });

      logger.info('HTTP Server started', {
        address,
        port: this.config.PORT,
        host: this.config.HOST,
        environment: this.config.NODE_ENV,
        metricsEnabled: this.config.METRICS_ENABLED,
        secretsValid: secretsValidation.valid,
        configValid: configValidation.valid
      });

      // Log any validation errors
      if (!secretsValidation.valid) {
        logger.warn('Secrets validation errors:', secretsValidation.errors);
      }
      if (!configValidation.valid) {
        logger.warn('Config validation errors:', configValidation.errors);
      }

    } catch (error) {
      logger.error('Failed to start HTTP server:', error);
      throw error;
    }
  }

  public async stop(): Promise<void> {
    await this.fastify.close();
    logger.info('HTTP server stopped');
  }

  public getServer(): FastifyInstance {
    return this.fastify;
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private parseCspDirectives(cspString: string): Record<string, string[]> {
    const directives: Record<string, string[]> = {};
    
    cspString.split(';').forEach(directive => {
      const [key, ...values] = directive.trim().split(' ');
      if (key && values.length > 0) {
        directives[this.camelCaseCSP(key)] = values;
      }
    });

    return directives;
  }

  private camelCaseCSP(str: string): string {
    return str.replace(/-([a-z])/g, (g) => g[1].toUpperCase());
  }
}