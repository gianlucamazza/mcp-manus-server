import { describe, it, expect, beforeEach } from '@jest/globals';
import { z } from 'zod';
import { ToolManager } from '../../../src/tools/manager.js';
import { SecurityContext } from '../../../src/types/index.js';

describe('ToolManager', () => {
  let toolManager: ToolManager;
  let mockSecurityContext: SecurityContext;

  beforeEach(() => {
    toolManager = new ToolManager();
    mockSecurityContext = {
      userId: 'test-user',
      permissions: ['read', 'write'],
      rateLimit: {
        requests: 100,
        windowMs: 60000
      }
    };
  });

  describe('Default Tools', () => {
    it('should register default tools on initialization', () => {
      const tools = toolManager.listTools();
      
      expect(tools).toHaveLength(3);
      expect(tools.map(t => t.name)).toContain('get_system_info');
      expect(tools.map(t => t.name)).toContain('echo');
      expect(tools.map(t => t.name)).toContain('check_manus_credits');
    });

    it('should have correct tool descriptions', () => {
      expect(toolManager.getToolDescription('echo')).toBe('Echo the input message');
      expect(toolManager.getToolDescription('get_system_info')).toBe('Get basic system information');
      expect(toolManager.getToolDescription('check_manus_credits')).toBe('Check available Manus.im credits');
    });
  });

  describe('Tool Registration', () => {
    it('should register a new tool successfully', () => {
      const customTool = {
        name: 'custom_tool',
        description: 'A custom test tool',
        inputSchema: z.object({
          input: z.string()
        }),
        handler: async (input: unknown) => ({ result: 'custom' })
      };

      toolManager.registerTool(customTool);
      
      expect(toolManager.hasTool('custom_tool')).toBe(true);
      expect(toolManager.getToolDescription('custom_tool')).toBe('A custom test tool');
    });

    it('should overwrite existing tool when registering with same name', () => {
      const newEchoTool = {
        name: 'echo',
        description: 'New echo tool',
        inputSchema: z.object({
          message: z.string()
        }),
        handler: async (input: unknown) => ({ newEcho: true })
      };

      toolManager.registerTool(newEchoTool);
      
      expect(toolManager.getToolDescription('echo')).toBe('New echo tool');
    });
  });

  describe('Tool Execution', () => {
    it('should execute echo tool successfully', async () => {
      const result = await toolManager.callTool(
        'echo',
        { message: 'test message' },
        mockSecurityContext
      );

      expect(result).toEqual({
        echo: 'test message',
        timestamp: expect.any(String)
      });
    });

    it('should execute get_system_info tool successfully', async () => {
      const result = await toolManager.callTool(
        'get_system_info',
        {},
        mockSecurityContext
      ) as any;

      expect(result).toHaveProperty('platform');
      expect(result).toHaveProperty('arch');
      expect(result).toHaveProperty('nodeVersion');
      expect(result).toHaveProperty('uptime');
      expect(result).toHaveProperty('memory');
    });

    it('should execute check_manus_credits tool successfully', async () => {
      const result = await toolManager.callTool(
        'check_manus_credits',
        {},
        mockSecurityContext
      ) as any;

      expect(result).toHaveProperty('total');
      expect(result).toHaveProperty('used');
      expect(result).toHaveProperty('remaining');
      expect(result).toHaveProperty('dailyLimit');
      expect(result).toHaveProperty('resetTime');
      expect(typeof result.total).toBe('number');
      expect(typeof result.used).toBe('number');
      expect(typeof result.remaining).toBe('number');
    });

    it('should throw error for non-existent tool', async () => {
      await expect(
        toolManager.callTool('non_existent_tool', {}, mockSecurityContext)
      ).rejects.toThrow('Tool not found: non_existent_tool');
    });

    it('should validate input schema and throw error for invalid input', async () => {
      await expect(
        toolManager.callTool('echo', { wrongField: 'value' }, mockSecurityContext)
      ).rejects.toThrow('Invalid input for tool echo');
    });

    it('should validate input schema and accept valid input', async () => {
      const result = await toolManager.callTool(
        'echo',
        { message: 'valid input' },
        mockSecurityContext
      );

      expect(result).toEqual({
        echo: 'valid input',
        timestamp: expect.any(String)
      });
    });
  });

  describe('Tool Queries', () => {
    it('should check if tool exists correctly', () => {
      expect(toolManager.hasTool('echo')).toBe(true);
      expect(toolManager.hasTool('non_existent')).toBe(false);
    });

    it('should return undefined for non-existent tool description', () => {
      expect(toolManager.getToolDescription('non_existent')).toBeUndefined();
    });

    it('should list all tools with correct structure', () => {
      const tools = toolManager.listTools();
      
      tools.forEach(tool => {
        expect(tool).toHaveProperty('name');
        expect(tool).toHaveProperty('description');
        expect(tool).toHaveProperty('inputSchema');
        expect(typeof tool.name).toBe('string');
        expect(typeof tool.description).toBe('string');
      });
    });
  });
});