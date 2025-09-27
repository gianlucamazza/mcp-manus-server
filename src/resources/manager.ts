import { MCPResource, SecurityContext } from '../types/index.js';
import { logger } from '../utils/logger.js';

export class ResourceManager {
  private resources = new Map<string, MCPResource>();

  constructor() {
    this.registerDefaultResources();
  }

  private registerDefaultResources(): void {
    // System status resource
    this.registerResource({
      uri: 'mcp://system/status',
      name: 'System Status',
      description: 'Current system status and health information',
      mimeType: 'application/json'
    });

    // Configuration resource
    this.registerResource({
      uri: 'mcp://config/server',
      name: 'Server Configuration',
      description: 'Current server configuration (sanitized)',
      mimeType: 'application/json'
    });

    // Manus API status resource
    this.registerResource({
      uri: 'mcp://manus/status',
      name: 'Manus.im API Status',
      description: 'Current status of Manus.im API integration',
      mimeType: 'application/json'
    });
  }

  public registerResource(resource: MCPResource): void {
    if (this.resources.has(resource.uri)) {
      logger.warn(`Resource ${resource.uri} already registered, overwriting`);
    }
    
    this.resources.set(resource.uri, resource);
    logger.info(`Registered resource: ${resource.uri}`);
  }

  public listResources(): Array<{ uri: string; name: string; description?: string; mimeType?: string }> {
    return Array.from(this.resources.values()).map(resource => ({
      uri: resource.uri,
      name: resource.name,
      description: resource.description,
      mimeType: resource.mimeType
    }));
  }

  public async readResource(uri: string, context: SecurityContext): Promise<MCPResource> {
    const resource = this.resources.get(uri);
    
    if (!resource) {
      throw new Error(`Resource not found: ${uri}`);
    }

    logger.info(`Reading resource: ${uri}`, { userId: context.userId });

    // Generate dynamic content based on URI
    const dynamicResource = await this.generateResourceContent(uri, resource);
    
    logger.info(`Resource ${uri} read successfully`);
    return dynamicResource;
  }

  private async generateResourceContent(uri: string, resource: MCPResource): Promise<MCPResource> {
    switch (uri) {
      case 'mcp://system/status':
        return {
          ...resource,
          text: JSON.stringify({
            timestamp: new Date().toISOString(),
            status: 'healthy',
            uptime: process.uptime(),
            memory: process.memoryUsage(),
            cpu: process.cpuUsage(),
            version: process.version,
            platform: process.platform
          }, null, 2)
        };

      case 'mcp://config/server':
        return {
          ...resource,
          text: JSON.stringify({
            name: 'mcp-manus-server',
            version: '1.0.0',
            capabilities: {
              tools: true,
              resources: true,
              prompts: false,
              logging: true
            },
            features: {
              oauth: true,
              docker: true,
              manus_integration: true
            }
          }, null, 2)
        };

      case 'mcp://manus/status':
        return {
          ...resource,
          text: JSON.stringify({
            status: 'pending_api_access',
            api_version: 'private_beta',
            integration_ready: true,
            last_check: new Date().toISOString(),
            features: {
              credits_tracking: true,
              multimodal_support: true,
              webhooks: true,
              real_time: true
            }
          }, null, 2)
        };

      default:
        return resource;
    }
  }

  public hasResource(uri: string): boolean {
    return this.resources.has(uri);
  }

  public getResourceInfo(uri: string): Pick<MCPResource, 'name' | 'description' | 'mimeType'> | undefined {
    const resource = this.resources.get(uri);
    if (!resource) return undefined;
    
    return {
      name: resource.name,
      description: resource.description,
      mimeType: resource.mimeType
    };
  }
}