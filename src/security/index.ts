import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import rateLimit from '@fastify/rate-limit';
import { Redis } from 'ioredis';
import { body, query, param, validationResult } from 'express-validator';
import { createDOMPurify } from 'dompurify';
import { JSDOM } from 'jsdom';
import { configManager } from '../utils/config.js';
import { logSecurityEvent, logError } from '../utils/logger.js';
import { metricsCollector } from '../monitoring/metrics.js';

// Initialize DOMPurify for XSS protection
const window = new JSDOM('').window;
const DOMPurify = createDOMPurify(window as any);

// Security configuration interface
export interface SecurityConfig {
  rateLimit: {
    max: number;
    timeWindow: string;
    redis?: {
      host: string;
      port: number;
      password?: string;
    };
  };
  cors: {
    origin: string | string[];
    credentials: boolean;
    methods: string[];
    allowedHeaders: string[];
  };
  csp: {
    directives: Record<string, string[]>;
    reportOnly: boolean;
    reportUri?: string;
  };
  headers: {
    hsts: {
      maxAge: number;
      includeSubDomains: boolean;
      preload: boolean;
    };
    xss: boolean;
    noSniff: boolean;
    frameOptions: string;
    referrerPolicy: string;
  };
}

export class SecurityManager {
  private redis?: Redis;
  private config: SecurityConfig;
  private suspiciousIPs = new Set<string>();
  private failedAttempts = new Map<string, { count: number; lastAttempt: number }>();

  constructor() {
    this.config = this.loadSecurityConfig();
    this.initializeRedis();
  }

  private loadSecurityConfig(): SecurityConfig {
    const appConfig = configManager.getConfig();
    
    return {
      rateLimit: {
        max: appConfig.RATE_LIMIT_REQUESTS,
        timeWindow: `${appConfig.RATE_LIMIT_WINDOW_MS}ms`,
        redis: appConfig.REDIS_URL ? {
          host: new URL(appConfig.REDIS_URL).hostname,
          port: parseInt(new URL(appConfig.REDIS_URL).port),
          password: appConfig.REDIS_URL.includes('@') ? 
            new URL(appConfig.REDIS_URL).password : undefined
        } : undefined
      },
      cors: {
        origin: configManager.getCorsOrigins(),
        credentials: appConfig.CORS_CREDENTIALS,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowedHeaders: [
          'Content-Type', 
          'Authorization', 
          'X-Requested-With',
          'X-Correlation-ID',
          'X-Request-ID',
          'X-Session-ID',
          'X-Trace-ID'
        ]
      },
      csp: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", "data:", "https:"],
          fontSrc: ["'self'"],
          connectSrc: ["'self'"],
          frameSrc: ["'none'"],
          objectSrc: ["'none'"],
          mediaSrc: ["'self'"],
          formAction: ["'self'"],
          frameAncestors: ["'none'"],
          baseUri: ["'self'"],
          upgradeInsecureRequests: []
        },
        reportOnly: appConfig.NODE_ENV === 'development',
        reportUri: '/api/security/csp-report'
      },
      headers: {
        hsts: {
          maxAge: appConfig.HSTS_MAX_AGE,
          includeSubDomains: appConfig.HSTS_INCLUDE_SUBDOMAINS,
          preload: appConfig.HSTS_PRELOAD
        },
        xss: true,
        noSniff: true,
        frameOptions: 'DENY',
        referrerPolicy: 'strict-origin-when-cross-origin'
      }
    };
  }

  private initializeRedis(): void {
    if (this.config.rateLimit.redis) {
      try {
        this.redis = new Redis({
          host: this.config.rateLimit.redis.host,
          port: this.config.rateLimit.redis.port,
          password: this.config.rateLimit.redis.password,
          retryDelayOnFailover: 100,
          maxRetriesPerRequest: 3,
          lazyConnect: true
        });

        this.redis.on('error', (error) => {
          logError(error, 'redis_connection', { component: 'security' });
        });

        this.redis.on('connect', () => {
          logSecurityEvent('redis_connected', { message: 'Redis connected for rate limiting' }, 'low');
        });
      } catch (error) {
        logError(error instanceof Error ? error : new Error(String(error)), 'redis_initialization');
      }
    }
  }

  public async registerSecurityMiddleware(fastify: FastifyInstance): Promise<void> {
    // Enhanced Rate Limiting
    await this.setupRateLimit(fastify);
    
    // Request validation middleware
    await this.setupRequestValidation(fastify);
    
    // Security headers middleware
    await this.setupSecurityHeaders(fastify);
    
    // Intrusion detection middleware
    await this.setupIntrusionDetection(fastify);
    
    // CSP violation reporting
    await this.setupCSPReporting(fastify);
  }

  private async setupRateLimit(fastify: FastifyInstance): Promise<void> {
    const rateLimitConfig: any = {
      max: this.config.rateLimit.max,
      timeWindow: this.config.rateLimit.timeWindow,
      skipSuccessfulRequests: false,
      skipFailedRequests: false,
      keyGenerator: (request: FastifyRequest) => {
        // Use X-Forwarded-For for real IP behind proxy
        const forwarded = request.headers['x-forwarded-for'] as string;
        const ip = forwarded ? forwarded.split(',')[0].trim() : request.ip;
        
        // Different limits for different endpoints
        const path = request.routerPath || request.url;
        if (path.includes('/oauth/')) return `oauth:${ip}`;
        if (path.includes('/api/')) return `api:${ip}`;
        return `general:${ip}`;
      },
      errorResponseBuilder: (request: FastifyRequest, context: any) => {
        const ip = request.ip;
        logSecurityEvent('rate_limit_exceeded', {
          ip,
          path: request.url,
          method: request.method,
          limit: context.max,
          remaining: context.ttl
        }, 'medium');

        metricsCollector.recordMetric('security_rate_limit_hits', 1, 'count', { ip, path: request.url });

        return {
          error: 'Too Many Requests',
          message: 'Rate limit exceeded. Please try again later.',
          retryAfter: Math.round(context.ttl / 1000)
        };
      }
    };

    // Use Redis for distributed rate limiting if available
    if (this.redis) {
      rateLimitConfig.store = {
        incr: async (key: string, ttl: number) => {
          const result = await this.redis!.multi()
            .incr(key)
            .expire(key, Math.ceil(ttl / 1000))
            .exec();
          
          return { current: result![0][1] as number, ttl };
        },
        child: (routeOptions: any) => rateLimitConfig.store
      };
    }

    await fastify.register(rateLimit, rateLimitConfig);
  }

  private async setupRequestValidation(fastify: FastifyInstance): Promise<void> {
    // Input sanitization middleware
    fastify.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        // Sanitize common injection attempts
        if (request.body && typeof request.body === 'object') {
          request.body = this.sanitizeObject(request.body);
        }

        if (request.query && typeof request.query === 'object') {
          request.query = this.sanitizeObject(request.query);
        }

        // Check for suspicious patterns
        const suspiciousPatterns = [
          /(<script|<iframe|<object|<embed)/i,
          /(union\s+select|drop\s+table|insert\s+into)/i,
          /(eval\s*\(|function\s*\(|setTimeout\s*\()/i,
          /(\.\.\/|\.\.\\|%2e%2e%2f)/i
        ];

        const requestString = JSON.stringify(request.body || {}) + 
                             JSON.stringify(request.query || {}) + 
                             request.url;

        for (const pattern of suspiciousPatterns) {
          if (pattern.test(requestString)) {
            logSecurityEvent('suspicious_request_detected', {
              ip: request.ip,
              url: request.url,
              method: request.method,
              pattern: pattern.toString(),
              userAgent: request.headers['user-agent']
            }, 'high');

            this.markSuspiciousIP(request.ip);
            
            reply.code(400).send({
              error: 'Bad Request',
              message: 'Invalid request format'
            });
            return;
          }
        }
      } catch (error) {
        logError(error instanceof Error ? error : new Error(String(error)), 'request_validation');
      }
    });
  }

  private async setupSecurityHeaders(fastify: FastifyInstance): Promise<void> {
    fastify.addHook('onSend', async (request: FastifyRequest, reply: FastifyReply, payload) => {
      // Enhanced security headers
      const headers = this.config.headers;
      
      // HSTS
      if (headers.hsts) {
        let hstsValue = `max-age=${headers.hsts.maxAge}`;
        if (headers.hsts.includeSubDomains) hstsValue += '; includeSubDomains';
        if (headers.hsts.preload) hstsValue += '; preload';
        reply.header('Strict-Transport-Security', hstsValue);
      }

      // Content Security Policy
      const cspDirectives = Object.entries(this.config.csp.directives)
        .map(([directive, sources]) => {
          const kebabDirective = directive.replace(/([A-Z])/g, '-$1').toLowerCase();
          return `${kebabDirective} ${sources.join(' ')}`;
        })
        .join('; ');

      const cspHeader = this.config.csp.reportOnly ? 
        'Content-Security-Policy-Report-Only' : 
        'Content-Security-Policy';
      
      reply.header(cspHeader, cspDirectives);

      // Additional security headers
      reply.header('X-Content-Type-Options', 'nosniff');
      reply.header('X-Frame-Options', headers.frameOptions);
      reply.header('X-XSS-Protection', '1; mode=block');
      reply.header('Referrer-Policy', headers.referrerPolicy);
      reply.header('Permissions-Policy', 'geolocation=(), camera=(), microphone=()');
      reply.header('Cross-Origin-Embedder-Policy', 'require-corp');
      reply.header('Cross-Origin-Opener-Policy', 'same-origin');
      reply.header('Cross-Origin-Resource-Policy', 'same-origin');

      return payload;
    });
  }

  private async setupIntrusionDetection(fastify: FastifyInstance): Promise<void> {
    fastify.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
      const ip = request.ip;
      
      // Check if IP is marked as suspicious
      if (this.suspiciousIPs.has(ip)) {
        logSecurityEvent('blocked_suspicious_ip', {
          ip,
          url: request.url,
          method: request.method
        }, 'high');

        reply.code(403).send({
          error: 'Forbidden',
          message: 'Access denied'
        });
        return;
      }

      // Track failed authentication attempts
      if (request.url.includes('/oauth/') || request.url.includes('/auth/')) {
        this.trackAuthenticationAttempt(ip);
      }

      // Advanced threat detection
      await this.detectAdvancedThreats(request, reply);
    });
  }

  private async setupCSPReporting(fastify: FastifyInstance): Promise<void> {
    fastify.post('/api/security/csp-report', async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const report = request.body as any;
        
        logSecurityEvent('csp_violation', {
          violatedDirective: report['csp-report']?.['violated-directive'],
          blockedUri: report['csp-report']?.['blocked-uri'],
          documentUri: report['csp-report']?.['document-uri'],
          sourceFile: report['csp-report']?.['source-file'],
          lineNumber: report['csp-report']?.['line-number'],
          userAgent: request.headers['user-agent']
        }, 'medium');

        reply.code(204).send();
      } catch (error) {
        logError(error instanceof Error ? error : new Error(String(error)), 'csp_report_processing');
        reply.code(400).send({ error: 'Invalid CSP report' });
      }
    });
  }

  private sanitizeObject(obj: any): any {
    if (typeof obj !== 'object' || obj === null) {
      return typeof obj === 'string' ? DOMPurify.sanitize(obj) : obj;
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.sanitizeObject(item));
    }

    const sanitized: any = {};
    for (const [key, value] of Object.entries(obj)) {
      const sanitizedKey = DOMPurify.sanitize(key);
      sanitized[sanitizedKey] = this.sanitizeObject(value);
    }

    return sanitized;
  }

  private markSuspiciousIP(ip: string): void {
    this.suspiciousIPs.add(ip);
    
    // Auto-remove after 1 hour
    setTimeout(() => {
      this.suspiciousIPs.delete(ip);
    }, 60 * 60 * 1000);
  }

  private trackAuthenticationAttempt(ip: string): void {
    const now = Date.now();
    const attempts = this.failedAttempts.get(ip) || { count: 0, lastAttempt: 0 };
    
    // Reset counter if last attempt was more than 15 minutes ago
    if (now - attempts.lastAttempt > 15 * 60 * 1000) {
      attempts.count = 0;
    }

    attempts.count++;
    attempts.lastAttempt = now;
    this.failedAttempts.set(ip, attempts);

    // Mark as suspicious after 5 failed attempts
    if (attempts.count >= 5) {
      this.markSuspiciousIP(ip);
      logSecurityEvent('multiple_auth_failures', {
        ip,
        attempts: attempts.count,
        timeWindow: '15m'
      }, 'critical');
    }
  }

  private async detectAdvancedThreats(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const userAgent = request.headers['user-agent'] || '';
    const ip = request.ip;
    
    // Detect bot patterns
    const botPatterns = [
      /curl|wget|python|java|go-http/i,
      /bot|crawler|spider|scraper/i,
      /automation|headless|phantom/i
    ];

    if (botPatterns.some(pattern => pattern.test(userAgent))) {
      // Log but don't block (might be legitimate API calls)
      logSecurityEvent('bot_detected', {
        ip,
        userAgent,
        url: request.url
      }, 'low');
    }

    // Detect scanner tools
    const scannerPatterns = [
      /nmap|masscan|zmap/i,
      /sqlmap|burp|owasp/i,
      /nikto|dirb|gobuster/i
    ];

    if (scannerPatterns.some(pattern => pattern.test(userAgent))) {
      this.markSuspiciousIP(ip);
      logSecurityEvent('security_scanner_detected', {
        ip,
        userAgent,
        url: request.url
      }, 'critical');

      reply.code(403).send({
        error: 'Forbidden',
        message: 'Security scanner detected'
      });
      return;
    }

    // Detect unusual request patterns
    const url = request.url.toLowerCase();
    const suspiciousUrlPatterns = [
      /\.(php|asp|jsp|cgi)$/,
      /(admin|wp-admin|phpmyadmin)/,
      /(etc\/passwd|windows\/system32)/,
      /\.(git|svn|env|config)$/
    ];

    if (suspiciousUrlPatterns.some(pattern => pattern.test(url))) {
      logSecurityEvent('suspicious_url_access', {
        ip,
        url: request.url,
        userAgent
      }, 'medium');
    }
  }

  public getSecurityMetrics(): Record<string, number> {
    return {
      suspiciousIPs: this.suspiciousIPs.size,
      failedAuthAttempts: Array.from(this.failedAttempts.values())
        .reduce((sum, attempts) => sum + attempts.count, 0),
      redisConnected: this.redis?.status === 'ready' ? 1 : 0
    };
  }

  public async cleanup(): Promise<void> {
    if (this.redis) {
      await this.redis.quit();
    }
    this.suspiciousIPs.clear();
    this.failedAttempts.clear();
  }
}

// Export singleton instance
export const securityManager = new SecurityManager();

// Validation schemas for common endpoints
export const validationSchemas = {
  oauth: {
    authorize: [
      query('client_id').isString().notEmpty().escape(),
      query('redirect_uri').isURL().escape(),
      query('response_type').isIn(['code']),
      query('state').isString().optional().escape(),
      query('scope').isString().optional().escape(),
      query('code_challenge').isString().optional().escape(),
      query('code_challenge_method').isIn(['S256']).optional()
    ],
    token: [
      body('grant_type').isIn(['authorization_code', 'refresh_token']),
      body('client_id').isString().notEmpty().escape(),
      body('client_secret').isString().optional().escape(),
      body('code').isString().optional().escape(),
      body('redirect_uri').isURL().optional().escape(),
      body('code_verifier').isString().optional().escape()
    ]
  },
  mcp: {
    toolCall: [
      body('name').isString().notEmpty().escape(),
      body('arguments').isObject().optional()
    ],
    resourceRead: [
      param('uri').isString().notEmpty().escape()
    ]
  }
};

export { validationResult };