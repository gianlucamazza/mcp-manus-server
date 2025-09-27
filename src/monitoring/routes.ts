import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { 
  createMetricsHandler, 
  createHealthHandler, 
  createReadinessHandler 
} from './middleware.js';
import { metricsCollector } from './metrics.js';
import { logger } from '../utils/logger.js';

export async function registerMonitoringRoutes(fastify: FastifyInstance): Promise<void> {
  // Prometheus metrics endpoint
  fastify.get('/metrics', {
    schema: {
      description: 'Prometheus metrics endpoint',
      tags: ['monitoring'],
      response: {
        200: {
          type: 'string',
          description: 'Prometheus metrics in text format'
        },
        500: {
          type: 'object',
          properties: {
            error: { type: 'string' }
          }
        }
      }
    }
  }, createMetricsHandler());

  // Health check endpoint (liveness probe)
  fastify.get('/health', {
    schema: {
      description: 'Health check endpoint for liveness probes',
      tags: ['monitoring'],
      response: {
        200: {
          type: 'object',
          properties: {
            status: { type: 'string', enum: ['healthy'] },
            timestamp: { type: 'string' },
            checks: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  component: { type: 'string' },
                  status: { type: 'string' },
                  details: { type: 'object' }
                }
              }
            }
          }
        },
        503: {
          type: 'object',
          properties: {
            status: { type: 'string', enum: ['unhealthy'] },
            timestamp: { type: 'string' },
            checks: { type: 'array' }
          }
        }
      }
    }
  }, createHealthHandler());

  // Readiness check endpoint (readiness probe)
  fastify.get('/ready', {
    schema: {
      description: 'Readiness check endpoint for readiness probes',
      tags: ['monitoring'],
      response: {
        200: {
          type: 'object',
          properties: {
            status: { type: 'string', enum: ['ready'] },
            timestamp: { type: 'string' },
            checks: { type: 'array' }
          }
        },
        503: {
          type: 'object',
          properties: {
            status: { type: 'string', enum: ['not_ready'] },
            timestamp: { type: 'string' },
            checks: { type: 'array' }
          }
        }
      }
    }
  }, createReadinessHandler());

  // Detailed metrics endpoint (JSON format)
  fastify.get('/metrics/json', {
    schema: {
      description: 'Detailed metrics in JSON format',
      tags: ['monitoring'],
      response: {
        200: {
          type: 'object',
          properties: {
            timestamp: { type: 'string' },
            metrics: { type: 'object' }
          }
        }
      }
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const detailedMetrics = await metricsCollector.collectMetrics();
      reply.send(detailedMetrics);
    } catch (error) {
      logger.error('Failed to collect detailed metrics', {
        error: error instanceof Error ? error.message : String(error)
      });
      reply.code(500).send({ error: 'Failed to collect metrics' });
    }
  });

  // Metrics summary endpoint
  fastify.get('/metrics/summary', {
    schema: {
      description: 'Metrics summary for dashboard',
      tags: ['monitoring'],
      response: {
        200: {
          type: 'object',
          properties: {
            timestamp: { type: 'string' },
            server: { type: 'object' },
            mcp: { type: 'object' },
            oauth: { type: 'object' },
            manus: { type: 'object' },
            system: { type: 'object' }
          }
        }
      }
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const summary = await generateMetricsSummary();
      reply.send(summary);
    } catch (error) {
      logger.error('Failed to generate metrics summary', {
        error: error instanceof Error ? error.message : String(error)
      });
      reply.code(500).send({ error: 'Failed to generate summary' });
    }
  });

  // Live metrics endpoint (for real-time monitoring)
  fastify.get('/metrics/live', {
    schema: {
      description: 'Live metrics with WebSocket support',
      tags: ['monitoring']
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    // For future WebSocket implementation
    reply.send({
      message: 'Live metrics endpoint - WebSocket support coming soon',
      timestamp: new Date().toISOString()
    });
  });

  logger.info('Monitoring routes registered', {
    endpoints: ['/metrics', '/health', '/ready', '/metrics/json', '/metrics/summary', '/metrics/live']
  });
}

async function generateMetricsSummary() {
  const metrics = await metricsCollector.getRegistry().getMetricsAsJSON();
  const timestamp = new Date().toISOString();

  // Process metrics for summary
  const summary = {
    timestamp,
    server: {
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      cpu: process.cpuUsage(),
      version: process.version
    },
    mcp: {
      connections: extractMetricValue(metrics, 'mcp_server_connections_current'),
      requests_total: extractMetricValue(metrics, 'mcp_server_mcp_requests_total'),
      errors_total: extractMetricValue(metrics, 'mcp_server_mcp_errors_total'),
      avg_duration: extractMetricValue(metrics, 'mcp_server_mcp_request_duration_seconds', 'avg')
    },
    oauth: {
      authorizations_total: extractMetricValue(metrics, 'mcp_server_oauth_authorizations_total'),
      token_exchanges_total: extractMetricValue(metrics, 'mcp_server_oauth_token_exchanges_total'),
      errors_total: extractMetricValue(metrics, 'mcp_server_oauth_errors_total')
    },
    manus: {
      requests_total: extractMetricValue(metrics, 'mcp_server_manus_api_requests_total'),
      errors_total: extractMetricValue(metrics, 'mcp_server_manus_api_errors_total'),
      avg_duration: extractMetricValue(metrics, 'mcp_server_manus_api_request_duration_seconds', 'avg')
    },
    http: {
      requests_total: extractMetricValue(metrics, 'mcp_server_http_requests_total'),
      requests_in_flight: extractMetricValue(metrics, 'mcp_server_http_requests_in_flight'),
      avg_duration: extractMetricValue(metrics, 'mcp_server_http_request_duration_seconds', 'avg')
    },
    system: {
      secrets_status: extractMetricValue(metrics, 'mcp_server_secrets_load_status'),
      config_status: extractMetricValue(metrics, 'mcp_server_config_validation_status'),
      health_status: extractMetricValue(metrics, 'mcp_server_health_check_status')
    }
  };

  return summary;
}

function extractMetricValue(metrics: any[], metricName: string, aggregation: 'sum' | 'avg' | 'max' | 'min' = 'sum'): number {
  const metric = metrics.find(m => m.name === metricName);
  if (!metric || !metric.values || metric.values.length === 0) {
    return 0;
  }

  const values = metric.values.map((v: any) => Number(v.value)).filter((v: number) => !isNaN(v));
  if (values.length === 0) {
    return 0;
  }

  switch (aggregation) {
    case 'sum':
      return values.reduce((a: number, b: number) => a + b, 0);
    case 'avg':
      return values.reduce((a: number, b: number) => a + b, 0) / values.length;
    case 'max':
      return Math.max(...values);
    case 'min':
      return Math.min(...values);
    default:
      return values[0] || 0;
  }
}