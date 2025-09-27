import { describe, it, expect } from '@jest/globals';
import { 
  ManusCreditsSchema, 
  ManusTaskSchema, 
  ManusApiResponseSchema 
} from '../../src/types/index.js';

describe('Type Schemas', () => {
  describe('ManusCreditsSchema', () => {
    it('should validate correct credits data', () => {
      const validCredits = {
        total: 1000,
        used: 250,
        remaining: 750,
        dailyLimit: 300,
        resetTime: '2025-01-01T00:00:00.000Z'
      };

      const result = ManusCreditsSchema.parse(validCredits);
      expect(result).toEqual(validCredits);
    });

    it('should reject invalid credits data', () => {
      const invalidCredits = {
        total: 'not-a-number',
        used: 250,
        remaining: 750,
        dailyLimit: 300,
        resetTime: 'invalid-date'
      };

      expect(() => ManusCreditsSchema.parse(invalidCredits)).toThrow();
    });

    it('should reject missing required fields', () => {
      const incompleteCredits = {
        total: 1000,
        used: 250
        // missing remaining, dailyLimit, resetTime
      };

      expect(() => ManusCreditsSchema.parse(incompleteCredits)).toThrow();
    });
  });

  describe('ManusTaskSchema', () => {
    it('should validate correct task data', () => {
      const validTask = {
        id: 'task-123',
        type: 'text' as const,
        status: 'completed' as const,
        input: { prompt: 'Test prompt' },
        output: { result: 'Test output' },
        creditsUsed: 5,
        createdAt: '2025-01-01T00:00:00.000Z',
        completedAt: '2025-01-01T00:01:00.000Z'
      };

      const result = ManusTaskSchema.parse(validTask);
      expect(result).toEqual(validTask);
    });

    it('should validate task without optional fields', () => {
      const minimalTask = {
        id: 'task-123',
        type: 'code' as const,
        status: 'pending' as const,
        input: { code: 'console.log("test")' },
        creditsUsed: 3,
        createdAt: '2025-01-01T00:00:00.000Z'
      };

      const result = ManusTaskSchema.parse(minimalTask);
      expect(result).toEqual(minimalTask);
    });

    it('should reject invalid task type', () => {
      const invalidTask = {
        id: 'task-123',
        type: 'invalid-type',
        status: 'pending',
        input: {},
        creditsUsed: 1,
        createdAt: '2025-01-01T00:00:00.000Z'
      };

      expect(() => ManusTaskSchema.parse(invalidTask)).toThrow();
    });

    it('should reject invalid status', () => {
      const invalidTask = {
        id: 'task-123',
        type: 'text',
        status: 'invalid-status',
        input: {},
        creditsUsed: 1,
        createdAt: '2025-01-01T00:00:00.000Z'
      };

      expect(() => ManusTaskSchema.parse(invalidTask)).toThrow();
    });
  });

  describe('ManusApiResponseSchema', () => {
    it('should validate successful response', () => {
      const successResponse = {
        success: true,
        data: { result: 'success' },
        creditsUsed: 5
      };

      const result = ManusApiResponseSchema.parse(successResponse);
      expect(result).toEqual(successResponse);
    });

    it('should validate error response', () => {
      const errorResponse = {
        success: false,
        error: 'Something went wrong'
      };

      const result = ManusApiResponseSchema.parse(errorResponse);
      expect(result).toEqual(errorResponse);
    });

    it('should validate minimal response', () => {
      const minimalResponse = {
        success: true
      };

      const result = ManusApiResponseSchema.parse(minimalResponse);
      expect(result).toEqual(minimalResponse);
    });

    it('should reject response without success field', () => {
      const invalidResponse = {
        data: { result: 'success' }
      };

      expect(() => ManusApiResponseSchema.parse(invalidResponse)).toThrow();
    });
  });
});