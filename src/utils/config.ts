import { z } from 'zod';
import path from 'path';
import fs from 'fs';
import { logger } from './logger.js';

// Configuration schema validation
const ConfigSchema = z.object({
  // Environment
  NODE_ENV: z.enum(['development', 'staging', 'production']).default('development'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  
  // Server
  PORT: z.coerce.number().min(1).max(65535).default(3000),
  HOST: z.string().default('localhost'),
  BASE_URL: z.string().url(),
  RESOURCE_IDENTIFIER: z.string().url(),
  
  // OAuth 2.1
  OAUTH_CLIENT_ID: z.string().min(1),
  OAUTH_CLIENT_SECRET: z.string().min(32),
  OAUTH_REDIRECT_URI: z.string().url(),
  OAUTH_AUTH_URL: z.string().url(),
  OAUTH_TOKEN_URL: z.string().url(),
  OAUTH_SCOPES: z.string().default('read,write'),
  
  // Manus.im API
  MANUS_API_KEY: z.string().optional(),
  MANUS_API_URL: z.string().url().default('https://api.manus.run'),
  
  // Security
  JWT_SECRET: z.string().min(32),
  BCRYPT_ROUNDS: z.coerce.number().min(8).max(15).default(12),
  
  // Database (optional)
  DATABASE_URL: z.string().optional(),
  DATABASE_SSL: z.coerce.boolean().default(false),
  DATABASE_MAX_CONNECTIONS: z.coerce.number().default(10),
  REDIS_URL: z.string().optional(),
  REDIS_TLS: z.coerce.boolean().default(false),
  
  // Monitoring
  METRICS_ENABLED: z.coerce.boolean().default(true),
  METRICS_PORT: z.coerce.number().default(9090),
  PROMETHEUS_ENDPOINT: z.string().url().optional(),
  
  // Rate Limiting
  RATE_LIMIT_REQUESTS: z.coerce.number().default(100),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(60000),
  RATE_LIMIT_STORAGE: z.enum(['memory', 'redis']).default('memory'),
  
  // CORS
  CORS_ORIGIN: z.string().default('*'),
  CORS_CREDENTIALS: z.coerce.boolean().default(false),
  
  // Security Headers
  HSTS_MAX_AGE: z.coerce.number().default(31536000),
  HSTS_INCLUDE_SUBDOMAINS: z.coerce.boolean().default(false),
  HSTS_PRELOAD: z.coerce.boolean().default(false),
  CSP_DIRECTIVES: z.string().optional(),
  
  // Performance
  CLUSTER_MODE: z.coerce.boolean().default(false),
  WORKER_PROCESSES: z.union([z.coerce.number(), z.literal('auto')]).default(1),
  KEEP_ALIVE_TIMEOUT: z.coerce.number().default(5000),
  HEADERS_TIMEOUT: z.coerce.number().default(60000),
  
  // External Services
  SENTRY_DSN: z.string().optional(),
  SENTRY_ENVIRONMENT: z.string().optional(),
  NEW_RELIC_LICENSE_KEY: z.string().optional(),
  NEW_RELIC_APP_NAME: z.string().optional(),
  
  // Development
  HOT_RELOAD: z.coerce.boolean().default(false),
  DEBUG_SQL: z.coerce.boolean().default(false),
  MOCK_EXTERNAL_APIS: z.coerce.boolean().default(false)
});

export type Config = z.infer<typeof ConfigSchema>;

class ConfigManager {
  private config: Config | null = null;
  private envFiles: string[] = [];

  constructor() {
    this.loadConfiguration();
  }

  private loadConfiguration(): void {
    try {
      // Determine environment
      const env = process.env.NODE_ENV || 'development';
      
      // Load environment-specific config file
      const configDir = path.join(process.cwd(), 'config');
      const envFile = path.join(configDir, `${env}.env`);
      
      if (fs.existsSync(envFile)) {
        this.loadEnvFile(envFile);
        this.envFiles.push(envFile);
      }
      
      // Load local overrides if they exist
      const localEnvFile = path.join(configDir, `${env}.local.env`);
      if (fs.existsSync(localEnvFile)) {
        this.loadEnvFile(localEnvFile);
        this.envFiles.push(localEnvFile);
      }
      
      // Validate and parse configuration
      this.config = ConfigSchema.parse(process.env);
      
      logger.info('Configuration loaded successfully', {
        environment: this.config.NODE_ENV,
        configFiles: this.envFiles,
        port: this.config.PORT
      });
      
    } catch (error) {
      logger.error('Failed to load configuration:', error);
      throw new Error(`Configuration validation failed: ${error}`);
    }
  }

  private loadEnvFile(filePath: string): void {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.split('\n');
      
      for (const line of lines) {
        const trimmed = line.trim();
        
        // Skip comments and empty lines
        if (!trimmed || trimmed.startsWith('#')) {
          continue;
        }
        
        // Parse key=value pairs
        const equalIndex = trimmed.indexOf('=');
        if (equalIndex === -1) {
          continue;
        }
        
        const key = trimmed.substring(0, equalIndex).trim();
        let value = trimmed.substring(equalIndex + 1).trim();
        
        // Remove quotes if present
        if ((value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1);
        }
        
        // Support variable substitution ${VAR_NAME}
        value = this.substituteVariables(value);
        
        // Only set if not already defined (prioritize existing env vars)
        if (!(key in process.env)) {
          process.env[key] = value;
        }
      }
      
    } catch (error) {
      logger.warn(`Failed to load environment file ${filePath}:`, error);
    }
  }

  private substituteVariables(value: string): string {
    return value.replace(/\$\{([^}]+)\}/g, (match, varName) => {
      return process.env[varName] || match;
    });
  }

  public getConfig(): Config {
    if (!this.config) {
      throw new Error('Configuration not loaded');
    }
    return this.config;
  }

  public get<K extends keyof Config>(key: K): Config[K] {
    return this.getConfig()[key];
  }

  public isDevelopment(): boolean {
    return this.get('NODE_ENV') === 'development';
  }

  public isProduction(): boolean {
    return this.get('NODE_ENV') === 'production';
  }

  public isStaging(): boolean {
    return this.get('NODE_ENV') === 'staging';
  }

  public getCorsOrigins(): string[] {
    const origins = this.get('CORS_ORIGIN');
    if (origins === '*') {
      return ['*'];
    }
    return origins.split(',').map(origin => origin.trim());
  }

  public getOAuthScopes(): string[] {
    return this.get('OAUTH_SCOPES').split(',').map(scope => scope.trim());
  }

  public validateSecrets(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    const config = this.getConfig();
    
    // Check JWT secret strength
    if (config.JWT_SECRET.length < 32) {
      errors.push('JWT_SECRET must be at least 32 characters long');
    }
    
    // Check OAuth client secret strength
    if (config.OAUTH_CLIENT_SECRET.length < 32) {
      errors.push('OAUTH_CLIENT_SECRET must be at least 32 characters long');
    }
    
    // Production-specific validations
    if (this.isProduction()) {
      if (config.JWT_SECRET.includes('dev') || config.JWT_SECRET.includes('test')) {
        errors.push('Production JWT_SECRET appears to be a development value');
      }
      
      if (!config.DATABASE_SSL && config.DATABASE_URL) {
        errors.push('Database SSL should be enabled in production');
      }
      
      if (!config.SENTRY_DSN) {
        errors.push('Sentry DSN should be configured in production');
      }
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }

  public getSecurityHeaders(): Record<string, string> {
    const config = this.getConfig();
    const headers: Record<string, string> = {};
    
    // HSTS
    let hstsValue = `max-age=${config.HSTS_MAX_AGE}`;
    if (config.HSTS_INCLUDE_SUBDOMAINS) {
      hstsValue += '; includeSubDomains';
    }
    if (config.HSTS_PRELOAD) {
      hstsValue += '; preload';
    }
    headers['Strict-Transport-Security'] = hstsValue;
    
    // CSP
    if (config.CSP_DIRECTIVES) {
      headers['Content-Security-Policy'] = config.CSP_DIRECTIVES;
    }
    
    return headers;
  }

  public reload(): void {
    logger.info('Reloading configuration...');
    this.config = null;
    this.envFiles = [];
    this.loadConfiguration();
  }

  public getLoadedFiles(): string[] {
    return [...this.envFiles];
  }
}

// Export singleton instance
export const configManager = new ConfigManager();
export const config = configManager.getConfig();