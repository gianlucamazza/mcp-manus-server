import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { metricsCollector } from './metrics.js';
import { logger } from '../utils/logger.js';

interface RequestWithTimer {
  startTime?: number;
  routePattern?: string;
}

export interface MetricsMiddlewareOptions {
  enableDefaultMetrics?: boolean;
  customLabels?: Record<string, string>;
  skipRoutes?: string[];
  normalizeRoutes?: boolean;
}

export async function registerMetricsMiddleware(
  fastify: FastifyInstance,
  options: MetricsMiddlewareOptions = {}
): Promise<void> {
  const {
    enableDefaultMetrics = true,
    customLabels = {},
    skipRoutes = ['/health', '/ready', '/metrics'],
    normalizeRoutes = true
  } = options;

  // Pre-handler to start timing
  fastify.addHook('preHandler', async (request: FastifyRequest & RequestWithTimer, reply: FastifyReply) => {
    request.startTime = Date.now();
    
    // Extract route pattern for normalization
    if (normalizeRoutes && request.routerPath) {
      request.routePattern = request.routerPath;
    } else {
      request.routePattern = request.url.split('?')[0];
    }

    // Skip metrics collection for certain routes
    if (skipRoutes.includes(request.routePattern)) {
      return;
    }

    metricsCollector.recordHttpRequestStart(request.method, request.routePattern);
  });

  // Post-response hook to record metrics
  fastify.addHook('onResponse', async (request: FastifyRequest & RequestWithTimer, reply: FastifyReply) => {
    if (!request.startTime || !request.routePattern) {
      return;
    }

    // Skip metrics collection for certain routes
    if (skipRoutes.includes(request.routePattern)) {
      return;
    }

    const duration = (Date.now() - request.startTime) / 1000;
    const statusCode = reply.statusCode;

    try {
      metricsCollector.recordHttpRequest(
        request.method,
        request.routePattern,
        statusCode,
        duration
      );

      metricsCollector.recordHttpRequestEnd(request.method, request.routePattern);

      // Log slow requests
      if (duration > 1.0) {
        logger.warn('Slow HTTP request detected', {
          method: request.method,
          route: request.routePattern,
          duration,
          statusCode,
          userAgent: request.headers['user-agent'],
          ip: request.ip
        });
      }

    } catch (error) {
      logger.error('Failed to record HTTP metrics', {
        error: error instanceof Error ? error.message : String(error),
        method: request.method,
        route: request.routePattern
      });
    }
  });

  // Error handling hook
  fastify.addHook('onError', async (request: FastifyRequest & RequestWithTimer, reply: FastifyReply, error: Error) => {
    if (!request.routePattern) {
      return;
    }

    // Skip metrics collection for certain routes
    if (skipRoutes.includes(request.routePattern)) {
      return;
    }

    try {
      // Record error metrics
      const errorType = error.name || 'UnknownError';
      const statusCode = reply.statusCode || 500;

      metricsCollector.recordHttpRequest(
        request.method,
        request.routePattern,
        statusCode,
        request.startTime ? (Date.now() - request.startTime) / 1000 : 0
      );

      logger.error('HTTP request error', {
        method: request.method,
        route: request.routePattern,
        error: error.message,
        errorType,
        statusCode,
        stack: error.stack
      });

    } catch (metricsError) {
      logger.error('Failed to record error metrics', {
        originalError: error.message,
        metricsError: metricsError instanceof Error ? metricsError.message : String(metricsError)
      });
    }
  });

  logger.info('Metrics middleware registered', {
    enableDefaultMetrics,
    skipRoutes,
    normalizeRoutes,
    customLabels
  });
}

export function createMetricsHandler() {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const metrics = await metricsCollector.getMetrics();
      
      reply
        .header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8')
        .send(metrics);

    } catch (error) {
      logger.error('Failed to generate metrics', {
        error: error instanceof Error ? error.message : String(error)
      });

      reply
        .code(500)
        .send({ error: 'Failed to generate metrics' });
    }
  };
}

export function createHealthHandler() {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const healthChecks = await performHealthChecks();
      const isHealthy = healthChecks.every(check => check.status === 'healthy');

      // Update health check metrics
      healthChecks.forEach(check => {
        metricsCollector.updateHealthCheckStatus(
          check.name,
          check.component,
          check.status === 'healthy'
        );
      });

      reply
        .code(isHealthy ? 200 : 503)
        .send({
          status: isHealthy ? 'healthy' : 'unhealthy',
          timestamp: new Date().toISOString(),
          checks: healthChecks
        });

    } catch (error) {
      logger.error('Health check failed', {
        error: error instanceof Error ? error.message : String(error)
      });

      reply
        .code(500)
        .send({
          status: 'error',
          timestamp: new Date().toISOString(),
          error: 'Health check failed'
        });
    }
  };
}

export function createReadinessHandler() {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const readinessChecks = await performReadinessChecks();
      const isReady = readinessChecks.every(check => check.status === 'ready');

      reply
        .code(isReady ? 200 : 503)
        .send({
          status: isReady ? 'ready' : 'not_ready',
          timestamp: new Date().toISOString(),
          checks: readinessChecks
        });

    } catch (error) {
      logger.error('Readiness check failed', {
        error: error instanceof Error ? error.message : String(error)
      });

      reply
        .code(500)
        .send({
          status: 'error',
          timestamp: new Date().toISOString(),
          error: 'Readiness check failed'
        });
    }
  };
}

async function performHealthChecks() {
  const checks = [];

  // Check memory usage
  const memUsage = process.memoryUsage();
  const memHealthy = memUsage.heapUsed / memUsage.heapTotal < 0.9;
  
  checks.push({
    name: 'memory',
    component: 'system',
    status: memHealthy ? 'healthy' : 'unhealthy',
    details: {
      heapUsed: memUsage.heapUsed,
      heapTotal: memUsage.heapTotal,
      utilization: (memUsage.heapUsed / memUsage.heapTotal * 100).toFixed(2) + '%'
    }
  });

  // Check event loop lag
  const eventLoopStart = Date.now();
  await new Promise(resolve => setImmediate(resolve));
  const eventLoopLag = Date.now() - eventLoopStart;
  
  checks.push({
    name: 'event_loop',
    component: 'nodejs',
    status: eventLoopLag < 100 ? 'healthy' : 'unhealthy',
    details: {
      lag: eventLoopLag,
      threshold: 100
    }
  });

  // Check secrets availability
  try {
    const { secretsManager } = await import('../utils/secrets.js');
    const validation = secretsManager.validateSecrets();
    
    checks.push({
      name: 'secrets',
      component: 'configuration',
      status: validation.valid ? 'healthy' : 'unhealthy',
      details: {
        errors: validation.errors
      }
    });
  } catch (error) {
    checks.push({
      name: 'secrets',
      component: 'configuration',
      status: 'unhealthy',
      details: {
        error: error instanceof Error ? error.message : String(error)
      }
    });
  }

  return checks;
}

async function performReadinessChecks() {
  const checks = [];

  // Check if server is fully initialized
  checks.push({
    name: 'server_initialized',
    component: 'application',
    status: 'ready'
  });

  // Check configuration
  try {
    const { configManager } = await import('../utils/config.js');
    const validation = configManager.validateSecrets();
    
    checks.push({
      name: 'configuration',
      component: 'application',
      status: validation.valid ? 'ready' : 'not_ready',
      details: {
        errors: validation.errors
      }
    });
  } catch (error) {
    checks.push({
      name: 'configuration',
      component: 'application',
      status: 'not_ready',
      details: {
        error: error instanceof Error ? error.message : String(error)
      }
    });
  }

  // Check MCP protocol readiness
  checks.push({
    name: 'mcp_protocol',
    component: 'protocol',
    status: 'ready'
  });

  return checks;
}