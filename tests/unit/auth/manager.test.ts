import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { AuthManager } from '../../../src/auth/manager.js';

describe('AuthManager', () => {
  let authManager: AuthManager;

  beforeEach(() => {
    // Clear environment variables
    delete process.env.OAUTH_CLIENT_ID;
    delete process.env.OAUTH_CLIENT_SECRET;
    delete process.env.OAUTH_REDIRECT_URI;
    
    authManager = new AuthManager();
  });

  describe('Tool Access Validation', () => {
    it('should allow access to safe tools', async () => {
      const isAllowed = await authManager.validateToolAccess('echo', { message: 'test' });
      expect(isAllowed).toBe(true);
    });

    it('should deny access to restricted tools', async () => {
      const restrictedTools = ['system_admin', 'file_delete', 'network_scan'];
      
      for (const tool of restrictedTools) {
        const isAllowed = await authManager.validateToolAccess(tool, {});
        expect(isAllowed).toBe(false);
      }
    });

    it('should validate file paths for file_read tool', async () => {
      const restrictedPath = '/etc/passwd';
      const isAllowed = await authManager.validateToolAccess('file_read', { path: restrictedPath });
      expect(isAllowed).toBe(false);
    });

    it('should allow safe file paths for file_read tool', async () => {
      const safePath = '/tmp/safe-file.txt';
      const isAllowed = await authManager.validateToolAccess('file_read', { path: safePath });
      expect(isAllowed).toBe(true);
    });

    it('should respect rate limiting for tool access', async () => {
      // Make many requests quickly to trigger rate limit
      const requests = Array.from({ length: 102 }, (_, i) => 
        authManager.validateToolAccess('echo', { message: `test${i}` })
      );
      
      const results = await Promise.all(requests);
      
      // First 100 should be allowed, rest should be denied
      const allowedCount = results.filter(Boolean).length;
      expect(allowedCount).toBe(100);
    });
  });

  describe('Resource Access Validation', () => {
    it('should allow access to safe resources', async () => {
      const isAllowed = await authManager.validateResourceAccess('mcp://system/status');
      expect(isAllowed).toBe(true);
    });

    it('should deny access to restricted resources', async () => {
      const restrictedUris = [
        'file:///etc/passwd',
        'file:///etc/shadow',
        'mcp://admin/secret'
      ];
      
      for (const uri of restrictedUris) {
        const isAllowed = await authManager.validateResourceAccess(uri);
        expect(isAllowed).toBe(false);
      }
    });

    it('should respect rate limiting for resource access', async () => {
      // Make many requests quickly to trigger rate limit
      const requests = Array.from({ length: 52 }, (_, i) => 
        authManager.validateResourceAccess(`mcp://test/resource${i}`)
      );
      
      const results = await Promise.all(requests);
      
      // First 50 should be allowed, rest should be denied
      const allowedCount = results.filter(Boolean).length;
      expect(allowedCount).toBe(50);
    });
  });

  describe('OAuth Configuration', () => {
    it('should handle missing OAuth configuration', () => {
      expect(() => authManager.generateAuthUrl()).toThrow('OAuth not configured');
    });

    it('should generate auth URL when configured', () => {
      // Set environment variables
      process.env.OAUTH_CLIENT_ID = 'test-client-id';
      process.env.OAUTH_CLIENT_SECRET = 'test-client-secret';
      process.env.OAUTH_REDIRECT_URI = 'http://localhost:3000/callback';
      
      // Create new instance with config
      const configuredAuthManager = new AuthManager();
      
      const authUrl = configuredAuthManager.generateAuthUrl();
      
      expect(authUrl).toContain('test-client-id');
      expect(authUrl).toContain('http://localhost:3000/callback');
      expect(authUrl).toContain('response_type=code');
    });

    it('should handle token exchange', async () => {
      // Set environment variables
      process.env.OAUTH_CLIENT_ID = 'test-client-id';
      process.env.OAUTH_CLIENT_SECRET = 'test-client-secret';
      process.env.OAUTH_REDIRECT_URI = 'http://localhost:3000/callback';
      
      const configuredAuthManager = new AuthManager();
      
      // Generate a valid state
      const authUrl = configuredAuthManager.generateAuthUrl();
      const urlParams = new URL(authUrl).searchParams;
      const state = urlParams.get('state');
      
      // Exchange code for token
      const token = await configuredAuthManager.exchangeCodeForToken('test-code', state!);
      
      expect(token).toHaveProperty('token');
      expect(token).toHaveProperty('refreshToken');
      expect(token).toHaveProperty('expiresAt');
      expect(token).toHaveProperty('scopes');
      expect(token.expiresAt).toBeInstanceOf(Date);
    });

    it('should reject invalid state in token exchange', async () => {
      process.env.OAUTH_CLIENT_ID = 'test-client-id';
      process.env.OAUTH_CLIENT_SECRET = 'test-client-secret';
      process.env.OAUTH_REDIRECT_URI = 'http://localhost:3000/callback';
      
      const configuredAuthManager = new AuthManager();
      
      await expect(
        configuredAuthManager.exchangeCodeForToken('test-code', 'invalid-state')
      ).rejects.toThrow('Invalid state parameter');
    });
  });

  describe('Authentication Status', () => {
    it('should return false for non-authenticated user', () => {
      expect(authManager.isAuthenticated()).toBe(false);
    });

    it('should return empty scopes for non-authenticated user', () => {
      expect(authManager.getScopes()).toEqual([]);
    });

    it('should return true for authenticated user with valid token', async () => {
      // Set environment variables and create token
      process.env.OAUTH_CLIENT_ID = 'test-client-id';
      process.env.OAUTH_CLIENT_SECRET = 'test-client-secret';
      process.env.OAUTH_REDIRECT_URI = 'http://localhost:3000/callback';
      
      const configuredAuthManager = new AuthManager();
      const authUrl = configuredAuthManager.generateAuthUrl();
      const urlParams = new URL(authUrl).searchParams;
      const state = urlParams.get('state');
      
      await configuredAuthManager.exchangeCodeForToken('test-code', state!);
      
      expect(configuredAuthManager.isAuthenticated()).toBe(true);
      expect(configuredAuthManager.getScopes()).toEqual(['read', 'write']);
    });
  });
});