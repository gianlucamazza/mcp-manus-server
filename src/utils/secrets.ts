import { promises as fs } from 'fs';
import path from 'path';
import { logger } from './logger.js';

export interface SecretConfig {
  name: string;
  path?: string;
  envVar?: string;
  required: boolean;
  minLength?: number;
  validation?: (value: string) => boolean;
}

export class SecretsManager {
  private secrets = new Map<string, string>();
  private secretConfigs: SecretConfig[] = [
    {
      name: 'jwt_secret',
      path: '/run/secrets/jwt_secret',
      envVar: 'JWT_SECRET',
      required: true,
      minLength: 32
    },
    {
      name: 'oauth_client_secret',
      path: '/run/secrets/oauth_client_secret',
      envVar: 'OAUTH_CLIENT_SECRET',
      required: true,
      minLength: 32
    },
    {
      name: 'manus_api_key',
      path: '/run/secrets/manus_api_key',
      envVar: 'MANUS_API_KEY',
      required: false,
      minLength: 20
    },
    {
      name: 'database_password',
      path: '/run/secrets/database_password',
      envVar: 'DATABASE_PASSWORD',
      required: false,
      minLength: 16
    },
    {
      name: 'redis_password',
      path: '/run/secrets/redis_password',
      envVar: 'REDIS_PASSWORD',
      required: false,
      minLength: 16
    },
    {
      name: 'sentry_dsn',
      path: '/run/secrets/sentry_dsn',
      envVar: 'SENTRY_DSN',
      required: false,
      validation: (value) => value.startsWith('https://') && value.includes('@sentry.io')
    }
  ];

  constructor() {
    // Initialize secrets loading
    this.loadSecrets().catch(error => {
      logger.error('Failed to load secrets:', error);
      process.exit(1);
    });
  }

  private async loadSecrets(): Promise<void> {
    const loadPromises = this.secretConfigs.map(config => this.loadSecret(config));
    const results = await Promise.allSettled(loadPromises);
    
    const errors: string[] = [];
    
    results.forEach((result, index) => {
      const config = this.secretConfigs[index];
      
      if (result.status === 'rejected') {
        if (config.required) {
          errors.push(`Required secret '${config.name}' failed to load: ${result.reason}`);
        } else {
          logger.warn(`Optional secret '${config.name}' not loaded: ${result.reason}`);
        }
      }
    });
    
    if (errors.length > 0) {
      throw new Error(`Secret loading failed:\n${errors.join('\n')}`);
    }
    
    logger.info(`Loaded ${this.secrets.size} secrets successfully`);
  }

  private async loadSecret(config: SecretConfig): Promise<void> {
    let secretValue: string | undefined;
    
    // Try loading from Docker secrets first
    if (config.path && await this.fileExists(config.path)) {
      try {
        secretValue = await fs.readFile(config.path, 'utf-8');
        secretValue = secretValue.trim();
        logger.debug(`Loaded secret '${config.name}' from Docker secrets`);
      } catch (error) {
        logger.warn(`Failed to read secret from ${config.path}:`, error);
      }
    }
    
    // Fall back to environment variable
    if (!secretValue && config.envVar) {
      secretValue = process.env[config.envVar];
      if (secretValue) {
        logger.debug(`Loaded secret '${config.name}' from environment variable`);
      }
    }
    
    // Validate secret
    if (!secretValue) {
      if (config.required) {
        throw new Error(`Required secret '${config.name}' not found`);
      }
      return;
    }
    
    // Validate minimum length
    if (config.minLength && secretValue.length < config.minLength) {
      throw new Error(`Secret '${config.name}' is too short (minimum ${config.minLength} characters)`);
    }
    
    // Custom validation
    if (config.validation && !config.validation(secretValue)) {
      throw new Error(`Secret '${config.name}' failed custom validation`);
    }
    
    // Store secret
    this.secrets.set(config.name, secretValue);
    
    // Update environment variable for backward compatibility
    if (config.envVar) {
      process.env[config.envVar] = secretValue;
    }
  }

  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  public getSecret(name: string): string | undefined {
    return this.secrets.get(name);
  }

  public getRequiredSecret(name: string): string {
    const secret = this.secrets.get(name);
    if (!secret) {
      throw new Error(`Required secret '${name}' not available`);
    }
    return secret;
  }

  public hasSecret(name: string): boolean {
    return this.secrets.has(name);
  }

  public listAvailableSecrets(): string[] {
    return Array.from(this.secrets.keys());
  }

  public validateSecrets(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    // Check for required secrets
    for (const config of this.secretConfigs) {
      if (config.required && !this.hasSecret(config.name)) {
        errors.push(`Required secret '${config.name}' is missing`);
      }
    }
    
    // Additional security validations
    const jwtSecret = this.getSecret('jwt_secret');
    if (jwtSecret) {
      // Check for weak patterns
      const weakPatterns = ['secret', 'password', '123456', 'qwerty', 'test', 'dev'];
      if (weakPatterns.some(pattern => jwtSecret.toLowerCase().includes(pattern))) {
        errors.push('JWT secret appears to contain weak patterns');
      }
      
      // Check entropy (basic check)
      const uniqueChars = new Set(jwtSecret).size;
      if (uniqueChars < jwtSecret.length * 0.6) {
        errors.push('JWT secret has low entropy');
      }
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }

  public rotateSecret(name: string, newValue: string): void {
    const config = this.secretConfigs.find(c => c.name === name);
    if (!config) {
      throw new Error(`Unknown secret '${name}'`);
    }
    
    // Validate new secret
    if (config.minLength && newValue.length < config.minLength) {
      throw new Error(`New secret value is too short (minimum ${config.minLength} characters)`);
    }
    
    if (config.validation && !config.validation(newValue)) {
      throw new Error(`New secret value failed validation`);
    }
    
    // Update secret
    this.secrets.set(name, newValue);
    
    // Update environment variable
    if (config.envVar) {
      process.env[config.envVar] = newValue;
    }
    
    logger.info(`Secret '${name}' rotated successfully`);
  }

  public generateSecureSecret(length: number = 32): string {
    const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    let result = '';
    const crypto = await import('crypto');
    
    for (let i = 0; i < length; i++) {
      const randomIndex = crypto.randomInt(0, charset.length);
      result += charset[randomIndex];
    }
    
    return result;
  }

  public async exportSecretsTemplate(): Promise<string> {
    const template = this.secretConfigs.map(config => {
      const description = config.required ? '[REQUIRED]' : '[OPTIONAL]';
      const minLength = config.minLength ? ` (min ${config.minLength} chars)` : '';
      return `# ${config.name}${minLength} ${description}\n${config.envVar || config.name.toUpperCase()}=`;
    }).join('\n\n');
    
    return `# MCP Manus Server - Secrets Template
# Copy this file and fill in the actual secret values
# DO NOT commit this file with real secrets to version control

${template}
`;
  }

  public async writeSecretsToFile(filePath: string): Promise<void> {
    const template = await this.exportSecretsTemplate();
    await fs.writeFile(filePath, template, { mode: 0o600 }); // Restrict file permissions
    logger.info(`Secrets template written to ${filePath}`);
  }

  public getSecretsStatus(): Record<string, { loaded: boolean; source: string; required: boolean }> {
    const status: Record<string, { loaded: boolean; source: string; required: boolean }> = {};
    
    for (const config of this.secretConfigs) {
      const loaded = this.hasSecret(config.name);
      let source = 'not loaded';
      
      if (loaded) {
        // Determine source (this is a simplified check)
        if (config.path && process.env[config.envVar!] === this.getSecret(config.name)) {
          source = 'environment variable';
        } else {
          source = 'docker secrets';
        }
      }
      
      status[config.name] = {
        loaded,
        source,
        required: config.required
      };
    }
    
    return status;
  }
}

// Export singleton instance
export const secretsManager = new SecretsManager();