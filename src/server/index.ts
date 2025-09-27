import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import { MCPServerConfig, SecurityContext } from '../types/index.js';
import { 
  logger, 
  logMCPOperation, 
  logSecurityEvent, 
  runWithCorrelation, 
  generateCorrelationId, 
  generateTraceId,
  logError 
} from '../utils/logger.js';
import { ToolManager } from '../tools/manager.js';
import { ResourceManager } from '../resources/manager.js';
import { AuthManager } from '../auth/manager.js';
import { metricsCollector } from '../monitoring/metrics.js';

export class MCPManusServer {
  private server: Server;
  private toolManager: ToolManager;
  private resourceManager: ResourceManager;
  private authManager: AuthManager;
  private config: MCPServerConfig;

  constructor(config: MCPServerConfig) {
    this.config = config;
    this.server = new Server(
      {
        name: config.name,
        version: config.version,
      },
      {
        capabilities: {
          resources: config.capabilities.resources ? {} : undefined,
          tools: config.capabilities.tools ? {} : undefined,
          prompts: config.capabilities.prompts ? {} : undefined,
          logging: config.capabilities.logging ? {} : undefined,
        },
      }
    );

    this.toolManager = new ToolManager();
    this.resourceManager = new ResourceManager();
    this.authManager = new AuthManager();

    this.setupHandlers();
    this.setupErrorHandling();
  }

  private setupHandlers(): void {
    // Tools handlers
    if (this.config.capabilities.tools) {
      this.server.setRequestHandler(ListToolsRequestSchema, async () => {
        const startTime = Date.now();
        
        return runWithCorrelation({
          correlationId: generateCorrelationId(),
          traceId: generateTraceId()
        }, () => {
          try {
            logMCPOperation('list_tools', {}, { operationId: 'mcp_list_tools' });
            const result = {
              tools: this.toolManager.listTools()
            };
            
            const duration = (Date.now() - startTime) / 1000;
            metricsCollector.recordMcpRequest('list_tools', 'tools', 'success', duration);
            
            logMCPOperation('list_tools', result, { 
              operationId: 'mcp_list_tools',
              duration,
              status: 'success',
              toolCount: result.tools.length 
            });
            
            return result;
          } catch (error) {
            metricsCollector.recordMcpError('list_tools_error', 'LIST_TOOLS_FAILED', 'list_tools');
            logError(error, 'mcp_list_tools');
            throw error;
          }
        });
      });

      this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
        const { name, arguments: args } = request.params;
        const startTime = Date.now();
        
        return runWithCorrelation({
          correlationId: generateCorrelationId(),
          traceId: generateTraceId()
        }, async () => {
          logMCPOperation('call_tool', { name, args }, { operationId: 'mcp_call_tool' });

          try {
            // Security validation
            const context = await this.validateToolCall(name, args);
            
            const result = await this.toolManager.callTool(name, args, context);
            
            const duration = (Date.now() - startTime) / 1000;
            metricsCollector.recordMcpRequest('call_tool', name, 'success', duration);
            
            logMCPOperation('call_tool', { name, result }, { 
              operationId: 'mcp_call_tool',
              duration,
              status: 'success',
              toolName: name 
            });
            
            return {
              content: [
                {
                  type: 'text',
                  text: typeof result === 'string' ? result : JSON.stringify(result, null, 2)
                }
              ]
            };
          } catch (error) {
            logSecurityEvent('tool_call_failed', { name, error: (error as Error).message }, 'high');
            metricsCollector.recordMcpError('tool_call_error', 'TOOL_CALL_FAILED', 'call_tool');
            logError(error, 'mcp_call_tool', { toolName: name, args });
            throw error;
          }
        });
      });
    }

    // Resources handlers
    if (this.config.capabilities.resources) {
      this.server.setRequestHandler(ListResourcesRequestSchema, async () => {
        const startTime = Date.now();
        
        return runWithCorrelation({
          correlationId: generateCorrelationId(),
          traceId: generateTraceId()
        }, () => {
          try {
            logMCPOperation('list_resources', {}, { operationId: 'mcp_list_resources' });
            const result = {
              resources: this.resourceManager.listResources()
            };
            
            const duration = (Date.now() - startTime) / 1000;
            metricsCollector.recordMcpRequest('list_resources', 'resources', 'success', duration);
            
            logMCPOperation('list_resources', result, { 
              operationId: 'mcp_list_resources',
              duration,
              status: 'success',
              resourceCount: result.resources.length 
            });
            
            return result;
          } catch (error) {
            metricsCollector.recordMcpError('list_resources_error', 'LIST_RESOURCES_FAILED', 'list_resources');
            logError(error, 'mcp_list_resources');
            throw error;
          }
        });
      });

      this.server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
        const { uri } = request.params;
        const startTime = Date.now();
        
        return runWithCorrelation({
          correlationId: generateCorrelationId(),
          traceId: generateTraceId()
        }, async () => {
          logMCPOperation('read_resource', { uri }, { operationId: 'mcp_read_resource' });

          try {
            const context = await this.validateResourceAccess(uri);
            const resource = await this.resourceManager.readResource(uri, context);
            
            const duration = (Date.now() - startTime) / 1000;
            metricsCollector.recordMcpRequest('read_resource', 'resource', 'success', duration);
            
            logMCPOperation('read_resource', { uri, resourceType: resource.mimeType }, { 
              operationId: 'mcp_read_resource',
              duration,
              status: 'success',
              uri,
              mimeType: resource.mimeType 
            });
            
            return {
              contents: [
                {
                  uri,
                  mimeType: resource.mimeType || 'text/plain',
                  text: resource.text,
                  blob: resource.blob
                }
              ]
            };
          } catch (error) {
            logSecurityEvent('resource_access_failed', { uri, error: (error as Error).message }, 'high');
            metricsCollector.recordMcpError('resource_access_error', 'RESOURCE_ACCESS_FAILED', 'read_resource');
            logError(error, 'mcp_read_resource', { uri });
            throw error;
          }
        });
      });
    }
  }

  private setupErrorHandling(): void {
    this.server.onerror = (error) => {
      logger.error('MCP Server Error:', error);
    };

    process.on('SIGINT', async () => {
      logger.info('Shutting down MCP server...');
      await this.server.close();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      logger.info('Received SIGTERM, shutting down gracefully...');
      await this.server.close();
      process.exit(0);
    });

    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
    });

    process.on('uncaughtException', (error) => {
      logger.error('Uncaught Exception:', error);
      process.exit(1);
    });
  }

  private async validateToolCall(toolName: string, args: unknown): Promise<SecurityContext> {
    // Implement tool-specific security validation
    const isAuthorized = await this.authManager.validateToolAccess(toolName, args);
    
    if (!isAuthorized) {
      throw new Error(`Unauthorized access to tool: ${toolName}`);
    }

    return {
      userId: 'default', // In production, extract from auth context
      permissions: ['read', 'write'], // Based on actual user permissions
      rateLimit: {
        requests: 100,
        windowMs: 60000
      }
    };
  }

  private async validateResourceAccess(uri: string): Promise<SecurityContext> {
    // Implement resource-specific security validation
    const isAuthorized = await this.authManager.validateResourceAccess(uri);
    
    if (!isAuthorized) {
      throw new Error(`Unauthorized access to resource: ${uri}`);
    }

    return {
      userId: 'default',
      permissions: ['read'],
      rateLimit: {
        requests: 50,
        windowMs: 60000
      }
    };
  }

  public async start(): Promise<void> {
    const transport = new StdioServerTransport();
    
    logger.info(`Starting MCP server: ${this.config.name} v${this.config.version}`);
    logger.info('Capabilities:', this.config.capabilities);

    await this.server.connect(transport);
    
    // Record connection metrics
    metricsCollector.recordMcpConnection(this.config.version, 'stdio', 1);
    
    logger.info('MCP server connected and ready');
  }

  public async stop(): Promise<void> {
    // Record disconnection metrics
    metricsCollector.recordMcpConnection(this.config.version, 'stdio', -1);
    
    await this.server.close();
    logger.info('MCP server stopped');
  }
}