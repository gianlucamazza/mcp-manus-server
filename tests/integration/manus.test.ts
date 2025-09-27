import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { ManusIntegration } from '../../src/integrations/manus.js';

// Mock axios
jest.unstable_mockModule('axios', () => ({
  default: {
    create: jest.fn(() => ({
      get: jest.fn(),
      post: jest.fn(),
      interceptors: {
        request: { use: jest.fn() },
        response: { use: jest.fn() }
      }
    }))
  }
}));

describe('ManusIntegration', () => {
  let manusIntegration: ManusIntegration;

  beforeEach(() => {
    // Clear environment variables
    delete process.env.MANUS_API_KEY;
    delete process.env.MANUS_API_URL;
    
    manusIntegration = new ManusIntegration();
  });

  describe('Configuration', () => {
    it('should not be configured without API key', () => {
      expect(manusIntegration.isConfigured()).toBe(false);
    });

    it('should be configured with API key', () => {
      process.env.MANUS_API_KEY = 'test-api-key';
      const configuredIntegration = new ManusIntegration();
      expect(configuredIntegration.isConfigured()).toBe(true);
    });

    it('should return correct API status', () => {
      const status = manusIntegration.getApiStatus();
      
      expect(status).toEqual({
        configured: false,
        baseUrl: 'https://api.manus.run',
        hasKey: false
      });
    });
  });

  describe('Credits Management', () => {
    it('should return mock credits when not configured', async () => {
      const credits = await manusIntegration.checkCredits();
      
      expect(credits).toEqual({
        total: 1000,
        used: 150,
        remaining: 850,
        dailyLimit: 300,
        resetTime: expect.any(String)
      });
      
      // Verify resetTime is a valid ISO string
      expect(() => new Date(credits.resetTime)).not.toThrow();
    });

    it('should validate credits schema', async () => {
      const credits = await manusIntegration.checkCredits();
      
      // Check all required fields exist and have correct types
      expect(typeof credits.total).toBe('number');
      expect(typeof credits.used).toBe('number');
      expect(typeof credits.remaining).toBe('number');
      expect(typeof credits.dailyLimit).toBe('number');
      expect(typeof credits.resetTime).toBe('string');
      
      // Check reasonable values
      expect(credits.total).toBeGreaterThan(0);
      expect(credits.used).toBeGreaterThanOrEqual(0);
      expect(credits.remaining).toBeGreaterThanOrEqual(0);
      expect(credits.dailyLimit).toBeGreaterThan(0);
    });
  });

  describe('Task Management', () => {
    it('should create mock task when not configured', async () => {
      const taskData = {
        type: 'text' as const,
        input: { prompt: 'Test prompt' }
      };
      
      const task = await manusIntegration.createTask(taskData);
      
      expect(task).toEqual({
        id: expect.stringMatching(/^mock_\d+$/),
        type: 'text',
        status: 'completed',
        input: { prompt: 'Test prompt' },
        output: { result: 'Mock output - API not configured' },
        creditsUsed: 5,
        createdAt: expect.any(String),
        completedAt: expect.any(String)
      });
    });

    it('should handle different task types', async () => {
      const taskTypes = ['text', 'image', 'code', 'file', 'web'] as const;
      
      for (const type of taskTypes) {
        const task = await manusIntegration.createTask({
          type,
          input: { test: `${type} input` }
        });
        
        expect(task.type).toBe(type);
        expect(task.status).toBe('completed');
      }
    });

    it('should retrieve mock task by ID', async () => {
      const taskId = 'test-task-123';
      const task = await manusIntegration.getTask(taskId);
      
      expect(task).toEqual({
        id: taskId,
        type: 'text',
        status: 'completed',
        input: {},
        output: { result: 'Mock task result' },
        creditsUsed: 3,
        createdAt: expect.any(String),
        completedAt: expect.any(String)
      });
    });

    it('should wait for task completion successfully', async () => {
      const taskId = 'test-task-123';
      const task = await manusIntegration.waitForTaskCompletion(taskId, 5000, 100);
      
      expect(task.status).toBe('completed');
      expect(task.id).toBe(taskId);
    });
  });

  describe('High-level Task Execution', () => {
    it('should execute text task successfully', async () => {
      const result = await manusIntegration.executeTextTask('Test prompt');
      
      expect(typeof result).toBe('string');
      expect(result).toBe('Mock task result');
    });

    it('should execute code task successfully', async () => {
      const code = 'console.log("Hello, World!");';
      const result = await manusIntegration.executeCodeTask(code, 'javascript');
      
      expect(typeof result).toBe('string');
      expect(result).toBe('Mock task result');
    });

    it('should handle code task with default language', async () => {
      const code = 'console.log("Hello, World!");';
      const result = await manusIntegration.executeCodeTask(code);
      
      expect(typeof result).toBe('string');
      expect(result).toBe('Mock task result');
    });
  });

  describe('Error Handling', () => {
    it('should handle task creation with options', async () => {
      const taskData = {
        type: 'code' as const,
        input: { code: 'test code' },
        options: { timeout: 30000, language: 'javascript' }
      };
      
      const task = await manusIntegration.createTask(taskData);
      
      expect(task.type).toBe('code');
      expect(task.input).toEqual({ code: 'test code' });
    });

    it('should validate task schema', async () => {
      const task = await manusIntegration.createTask({
        type: 'text',
        input: { prompt: 'test' }
      });
      
      // Verify all required fields are present
      expect(task).toHaveProperty('id');
      expect(task).toHaveProperty('type');
      expect(task).toHaveProperty('status');
      expect(task).toHaveProperty('input');
      expect(task).toHaveProperty('creditsUsed');
      expect(task).toHaveProperty('createdAt');
      
      // Verify types
      expect(typeof task.id).toBe('string');
      expect(['text', 'image', 'code', 'file', 'web']).toContain(task.type);
      expect(['pending', 'running', 'completed', 'failed']).toContain(task.status);
      expect(typeof task.creditsUsed).toBe('number');
      expect(typeof task.createdAt).toBe('string');
    });
  });
});