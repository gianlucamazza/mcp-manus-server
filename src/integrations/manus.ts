import axios, { AxiosInstance } from 'axios';
import { z } from 'zod';
import { 
  ManusCredits, 
  ManusTask, 
  ManusApiResponse,
  ManusCreditsSchema,
  ManusTaskSchema,
  ManusApiResponseSchema 
} from '../types/index.js';
import { logger } from '../utils/logger.js';

export class ManusIntegration {
  private apiClient: AxiosInstance;
  private apiKey: string | null;
  private baseUrl: string;

  constructor() {
    this.apiKey = process.env.MANUS_API_KEY || null;
    this.baseUrl = process.env.MANUS_API_URL || 'https://api.manus.run';
    
    this.apiClient = axios.create({
      baseURL: this.baseUrl,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'mcp-manus-server/1.0.0'
      }
    });

    this.setupInterceptors();
  }

  private setupInterceptors(): void {
    // Request interceptor for authentication
    this.apiClient.interceptors.request.use(
      (config) => {
        if (this.apiKey) {
          config.headers.Authorization = `Bearer ${this.apiKey}`;
        }
        
        logger.debug('Manus API Request:', {
          method: config.method,
          url: config.url,
          hasAuth: !!this.apiKey
        });
        
        return config;
      },
      (error) => {
        logger.error('Manus API Request Error:', error);
        return Promise.reject(error);
      }
    );

    // Response interceptor for logging and error handling
    this.apiClient.interceptors.response.use(
      (response) => {
        logger.debug('Manus API Response:', {
          status: response.status,
          url: response.config.url
        });
        return response;
      },
      (error) => {
        logger.error('Manus API Response Error:', {
          status: error.response?.status,
          message: error.message,
          url: error.config?.url
        });
        return Promise.reject(error);
      }
    );
  }

  public isConfigured(): boolean {
    return !!this.apiKey;
  }

  public async checkCredits(): Promise<ManusCredits> {
    if (!this.isConfigured()) {
      // Return mock data when API is not configured
      return {
        total: 1000,
        used: 150,
        remaining: 850,
        dailyLimit: 300,
        resetTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      };
    }

    try {
      const response = await this.apiClient.get('/v1/credits');
      const validated = ManusCreditsSchema.parse(response.data);
      
      logger.info('Credits checked successfully:', validated);
      return validated;
      
    } catch (error) {
      logger.error('Failed to check credits:', error);
      throw new Error('Failed to retrieve credits information');
    }
  }

  public async createTask(taskData: {
    type: 'text' | 'image' | 'code' | 'file' | 'web';
    input: unknown;
    options?: Record<string, unknown>;
  }): Promise<ManusTask> {
    if (!this.isConfigured()) {
      // Return mock task when API is not configured
      return {
        id: `mock_${Date.now()}`,
        type: taskData.type,
        status: 'completed',
        input: taskData.input,
        output: { result: 'Mock output - API not configured' },
        creditsUsed: 5,
        createdAt: new Date().toISOString(),
        completedAt: new Date().toISOString()
      };
    }

    try {
      const response = await this.apiClient.post('/v1/tasks', {
        type: taskData.type,
        input: taskData.input,
        options: taskData.options || {}
      });

      const validated = ManusTaskSchema.parse(response.data);
      
      logger.info('Task created successfully:', {
        id: validated.id,
        type: validated.type,
        status: validated.status
      });
      
      return validated;
      
    } catch (error) {
      logger.error('Failed to create task:', error);
      throw new Error('Failed to create Manus task');
    }
  }

  public async getTask(taskId: string): Promise<ManusTask> {
    if (!this.isConfigured()) {
      // Return mock task status
      return {
        id: taskId,
        type: 'text',
        status: 'completed',
        input: {},
        output: { result: 'Mock task result' },
        creditsUsed: 3,
        createdAt: new Date(Date.now() - 60000).toISOString(),
        completedAt: new Date().toISOString()
      };
    }

    try {
      const response = await this.apiClient.get(`/v1/tasks/${taskId}`);
      const validated = ManusTaskSchema.parse(response.data);
      
      logger.info('Task retrieved successfully:', {
        id: validated.id,
        status: validated.status
      });
      
      return validated;
      
    } catch (error) {
      logger.error('Failed to get task:', error);
      throw new Error(`Failed to retrieve task ${taskId}`);
    }
  }

  public async waitForTaskCompletion(
    taskId: string, 
    maxWaitMs: number = 30000,
    pollIntervalMs: number = 1000
  ): Promise<ManusTask> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < maxWaitMs) {
      const task = await this.getTask(taskId);
      
      if (task.status === 'completed' || task.status === 'failed') {
        return task;
      }
      
      await this.sleep(pollIntervalMs);
    }
    
    throw new Error(`Task ${taskId} did not complete within ${maxWaitMs}ms`);
  }

  public async executeTextTask(prompt: string): Promise<string> {
    const task = await this.createTask({
      type: 'text',
      input: { prompt }
    });
    
    const completedTask = await this.waitForTaskCompletion(task.id);
    
    if (completedTask.status === 'failed') {
      throw new Error('Text task failed');
    }
    
    return completedTask.output?.result || 'No output received';
  }

  public async executeCodeTask(code: string, language: string = 'javascript'): Promise<string> {
    const task = await this.createTask({
      type: 'code',
      input: { code, language }
    });
    
    const completedTask = await this.waitForTaskCompletion(task.id);
    
    if (completedTask.status === 'failed') {
      throw new Error('Code task failed');
    }
    
    return completedTask.output?.result || 'No output received';
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  public getApiStatus(): { configured: boolean; baseUrl: string; hasKey: boolean } {
    return {
      configured: this.isConfigured(),
      baseUrl: this.baseUrl,
      hasKey: !!this.apiKey
    };
  }
}