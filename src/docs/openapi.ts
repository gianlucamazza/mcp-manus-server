import { FastifyInstance } from 'fastify';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { configManager } from '../utils/config.js';

export const openApiConfig = {
  swagger: {
    info: {
      title: 'MCP Manus Server API',
      description: `
        # MCP Manus Server API

        Production-ready Model Context Protocol (MCP) server with Manus.im integration, 
        built following 2025 best practices for security, containerization, and scalability.

        ## Features

        - **MCP Compliance**: Latest Model Context Protocol specification (2025-06-18)
        - **OAuth 2.1 Security**: Modern authentication with PKCE and resource indicators
        - **Manus.im Integration**: Ready for Manus.im API integration with credit management
        - **Enterprise Monitoring**: Prometheus metrics, health checks, and audit trails
        - **Container Security**: Multi-stage builds, non-root execution, security hardening

        ## Authentication

        This API uses OAuth 2.1 with PKCE for secure authentication. All protected endpoints
        require a valid JWT token obtained through the OAuth authorization flow.

        ### OAuth Flow

        1. **Authorization**: Redirect to \`/oauth/authorize\` with PKCE challenge
        2. **Token Exchange**: Exchange authorization code for access token at \`/oauth/token\`
        3. **API Access**: Include access token in \`Authorization: Bearer <token>\` header

        ## Rate Limiting

        API endpoints are protected by rate limiting:
        - **General endpoints**: 100 requests per minute per IP
        - **OAuth endpoints**: 30 requests per minute per IP
        - **Monitoring endpoints**: 200 requests per minute per IP

        ## Monitoring

        - **Health Check**: \`GET /health\` - Liveness probe
        - **Readiness Check**: \`GET /ready\` - Readiness probe
        - **Metrics**: \`GET /metrics\` - Prometheus metrics
        - **Security**: \`GET /api/security/status\` - Security system status

        ## Error Handling

        All errors follow a consistent format with correlation IDs for debugging:

        \`\`\`json
        {
          "error": "Error Type",
          "message": "Human-readable error message",
          "correlationId": "550e8400-e29b-41d4-a716-446655440000",
          "requestId": "req_1704110400000_abc123def",
          "timestamp": "2025-01-01T12:00:00.000Z"
        }
        \`\`\`
      `,
      version: '1.0.0',
      contact: {
        name: 'Gianluca Mazza',
        email: 'info@gianlucamazza.it',
        url: 'https://github.com/gianlucamazza/mcp-manus-server'
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT'
      },
      termsOfService: 'https://github.com/gianlucamazza/mcp-manus-server/blob/main/docs/TERMS.md'
    },
    host: 'mcp-manus.example.com',
    schemes: ['https', 'http'],
    consumes: ['application/json'],
    produces: ['application/json'],
    tags: [
      {
        name: 'Health',
        description: 'Health check and system status endpoints'
      },
      {
        name: 'OAuth',
        description: 'OAuth 2.1 authentication and authorization endpoints'
      },
      {
        name: 'MCP',
        description: 'Model Context Protocol endpoints for tools and resources'
      },
      {
        name: 'Monitoring',
        description: 'Metrics, monitoring, and observability endpoints'
      },
      {
        name: 'Security',
        description: 'Security status and configuration endpoints'
      },
      {
        name: 'Manus',
        description: 'Manus.im API integration endpoints'
      }
    ],
    securityDefinitions: {
      BearerAuth: {
        type: 'apiKey',
        name: 'Authorization',
        in: 'header',
        description: 'JWT Bearer token obtained through OAuth 2.1 flow'
      },
      OAuthPKCE: {
        type: 'oauth2',
        authorizationUrl: 'https://mcp-manus.example.com/oauth/authorize',
        tokenUrl: 'https://mcp-manus.example.com/oauth/token',
        flow: 'authorizationCode',
        scopes: {
          'read': 'Read access to resources and tools',
          'write': 'Write access to tools and resource modification',
          'admin': 'Administrative access to server configuration'
        }
      }
    },
    security: [
      { BearerAuth: [] },
      { OAuthPKCE: ['read', 'write'] }
    ],
    externalDocs: {
      description: 'Model Context Protocol Specification',
      url: 'https://spec.modelcontextprotocol.io/specification/'
    }
  },
  transform: ({ schema, url }: any) => {
    // Transform function to customize the generated OpenAPI spec
    return {
      ...schema,
      servers: [
        {
          url: 'https://mcp-manus.example.com',
          description: 'Production server'
        },
        {
          url: 'https://staging-mcp-manus.example.com',
          description: 'Staging server'
        },
        {
          url: 'http://localhost:3000',
          description: 'Development server'
        }
      ],
      'x-correlation-id': {
        description: 'All requests include correlation IDs for tracing',
        example: '550e8400-e29b-41d4-a716-446655440000'
      }
    };
  }
};

export const swaggerUiConfig = {
  routePrefix: '/docs',
  exposeRoute: true,
  staticCSP: true,
  transformStaticCSP: (header: string) => header,
  uiConfig: {
    docExpansion: 'list',
    deepLinking: true,
    defaultModelsExpandDepth: 2,
    defaultModelExpandDepth: 2,
    displayOperationId: true,
    displayRequestDuration: true,
    filter: true,
    showExtensions: true,
    showCommonExtensions: true,
    tryItOutEnabled: true,
    requestSnippetsEnabled: true,
    syntaxHighlight: {
      activate: true,
      theme: 'agate'
    }
  },
  uiHooks: {
    onRequest: function (request: any, reply: any, next: any) {
      // Add security headers for docs
      reply.header('X-Frame-Options', 'SAMEORIGIN');
      next();
    },
    preHandler: function (request: any, reply: any, next: any) {
      // Log docs access for security monitoring
      const ip = request.ip;
      const userAgent = request.headers['user-agent'];
      
      // You could add logging here if needed
      next();
    }
  },
  theme: {
    title: 'MCP Manus Server API Documentation',
    favicon: [
      {
        filename: 'favicon.ico',
        rel: 'icon',
        sizes: '16x16',
        type: 'image/x-icon'
      }
    ]
  }
};

export async function registerOpenAPI(fastify: FastifyInstance): Promise<void> {
  const config = configManager.getConfig();
  
  // Update host based on environment
  openApiConfig.swagger.host = new URL(config.BASE_URL).host;
  openApiConfig.swagger.schemes = config.BASE_URL.startsWith('https') ? ['https'] : ['https', 'http'];

  // Register Swagger
  await fastify.register(swagger, openApiConfig);

  // Register Swagger UI (only in non-production or with auth)
  if (config.NODE_ENV !== 'production' || config.SWAGGER_ENABLED === 'true') {
    await fastify.register(swaggerUi, swaggerUiConfig);
  }

  // Add OpenAPI JSON endpoint
  fastify.get('/api/openapi.json', {
    schema: {
      description: 'OpenAPI 3.0 specification in JSON format',
      tags: ['Documentation'],
      response: {
        200: {
          type: 'object',
          description: 'OpenAPI specification'
        }
      }
    }
  }, async (request, reply) => {
    reply
      .header('Content-Type', 'application/json')
      .send(fastify.swagger());
  });

  // Add OpenAPI YAML endpoint
  fastify.get('/api/openapi.yaml', {
    schema: {
      description: 'OpenAPI 3.0 specification in YAML format',
      tags: ['Documentation'],
      response: {
        200: {
          type: 'string',
          description: 'OpenAPI specification in YAML'
        }
      }
    }
  }, async (request, reply) => {
    const yaml = await import('yaml');
    const spec = fastify.swagger();
    
    reply
      .header('Content-Type', 'application/x-yaml')
      .send(yaml.stringify(spec));
  });
}