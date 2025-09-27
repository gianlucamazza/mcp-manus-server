import { z } from 'zod';
import { MCPTool, SecurityContext } from '../types/index.js';
import { logger } from '../utils/logger.js';

export class ToolManager {
  private tools = new Map<string, MCPTool>();

  constructor() {
    this.registerDefaultTools();
  }

  private registerDefaultTools(): void {
    // System information tool
    this.registerTool({
      name: 'get_system_info',
      description: 'Get basic system information',
      inputSchema: z.object({}),
      handler: async () => {
        return {
          platform: process.platform,
          arch: process.arch,
          nodeVersion: process.version,
          uptime: process.uptime(),
          memory: process.memoryUsage()
        };
      }
    });

    // Echo tool for testing
    this.registerTool({
      name: 'echo',
      description: 'Echo the input message',
      inputSchema: z.object({
        message: z.string().describe('Message to echo')
      }),
      handler: async (input) => {
        const { message } = input as { message: string };
        return { echo: message, timestamp: new Date().toISOString() };
      }
    });

    // Manus credits check (placeholder)
    this.registerTool({
      name: 'check_manus_credits',
      description: 'Check available Manus.im credits',
      inputSchema: z.object({}),
      handler: async () => {
        // TODO: Implement actual Manus.im API call when available
        return {
          total: 1000,
          used: 250,
          remaining: 750,
          dailyLimit: 300,
          resetTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
        };
      }
    });
  }

  public registerTool(tool: MCPTool): void {
    if (this.tools.has(tool.name)) {
      logger.warn(`Tool ${tool.name} already registered, overwriting`);
    }
    
    this.tools.set(tool.name, tool);
    logger.info(`Registered tool: ${tool.name}`);
  }

  public listTools(): Array<{ name: string; description: string; inputSchema: unknown }> {
    return Array.from(this.tools.values()).map(tool => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema
    }));
  }

  public async callTool(
    name: string, 
    args: unknown, 
    context: SecurityContext
  ): Promise<unknown> {
    const tool = this.tools.get(name);
    
    if (!tool) {
      throw new Error(`Tool not found: ${name}`);
    }

    // Validate input schema
    try {
      const validatedArgs = tool.inputSchema.parse(args);
      
      logger.info(`Calling tool: ${name}`, { 
        args: validatedArgs, 
        userId: context.userId 
      });

      const result = await tool.handler(validatedArgs, context);
      
      logger.info(`Tool ${name} completed successfully`);
      return result;
      
    } catch (error) {
      logger.error(`Tool ${name} failed:`, error);
      
      if (error instanceof z.ZodError) {
        throw new Error(`Invalid input for tool ${name}: ${error.message}`);
      }
      
      throw error;
    }
  }

  public hasTool(name: string): boolean {
    return this.tools.has(name);
  }

  public getToolDescription(name: string): string | undefined {
    return this.tools.get(name)?.description;
  }
}