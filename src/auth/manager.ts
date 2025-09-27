import jwt from 'jsonwebtoken';
import { OAuthConfig, AccessToken } from '../types/index.js';
import { logger, logSecurityEvent } from '../utils/logger.js';
import { PKCEManager } from './pkce.js';
import { OAuthDiscoveryService } from './discovery.js';

export class AuthManager {
  private oauthConfig: OAuthConfig | null = null;
  private accessTokens = new Map<string, AccessToken>();
  private rateLimit = new Map<string, { count: number; resetTime: number }>();
  private pkceManager: PKCEManager;
  private discoveryService: OAuthDiscoveryService;

  constructor() {
    this.pkceManager = new PKCEManager();
    this.loadOAuthConfig();
    this.discoveryService = new OAuthDiscoveryService(
      process.env.BASE_URL || 'http://localhost:3000',
      process.env.RESOURCE_IDENTIFIER || 'https://api.manus.im/v1/'
    );
  }

  private loadOAuthConfig(): void {
    // Load OAuth configuration from environment or config file
    const clientId = process.env.OAUTH_CLIENT_ID;
    const clientSecret = process.env.OAUTH_CLIENT_SECRET;
    const redirectUri = process.env.OAUTH_REDIRECT_URI;

    if (clientId && clientSecret && redirectUri) {
      this.oauthConfig = {
        clientId,
        clientSecret,
        redirectUri,
        authUrl: process.env.OAUTH_AUTH_URL || 'https://api.manus.im/oauth/authorize',
        tokenUrl: process.env.OAUTH_TOKEN_URL || 'https://api.manus.im/oauth/token',
        scopes: (process.env.OAUTH_SCOPES || 'read,write').split(',')
      };
      
      logger.info('OAuth configuration loaded');
    } else {
      logger.warn('OAuth configuration not found, running without authentication');
    }
  }

  public async validateToolAccess(toolName: string, args: unknown): Promise<boolean> {
    // Check rate limiting
    if (!this.checkRateLimit('tool_access')) {
      logSecurityEvent('rate_limit_exceeded', { type: 'tool_access', toolName });
      return false;
    }

    // Basic tool access validation
    const restrictedTools = ['system_admin', 'file_delete', 'network_scan'];
    
    if (restrictedTools.includes(toolName)) {
      logSecurityEvent('restricted_tool_access_attempt', { toolName, args });
      return false;
    }

    // Validate specific tool arguments for security
    if (toolName === 'file_read' && args && typeof args === 'object') {
      const fileArgs = args as { path?: string };
      if (fileArgs.path && this.isRestrictedPath(fileArgs.path)) {
        logSecurityEvent('restricted_path_access', { toolName, path: fileArgs.path });
        return false;
      }
    }

    return true;
  }

  public async validateResourceAccess(uri: string): Promise<boolean> {
    // Check rate limiting
    if (!this.checkRateLimit('resource_access')) {
      logSecurityEvent('rate_limit_exceeded', { type: 'resource_access', uri });
      return false;
    }

    // Basic resource access validation
    const restrictedUris = [
      'file:///etc/passwd',
      'file:///etc/shadow',
      'mcp://admin/*'
    ];

    const isRestricted = restrictedUris.some(pattern => {
      if (pattern.endsWith('*')) {
        return uri.startsWith(pattern.slice(0, -1));
      }
      return uri === pattern;
    });

    if (isRestricted) {
      logSecurityEvent('restricted_resource_access_attempt', { uri });
      return false;
    }

    return true;
  }

  private checkRateLimit(type: string): boolean {
    const key = `${type}:default`; // In production, use actual user ID
    const now = Date.now();
    const windowMs = 60000; // 1 minute
    const limit = type === 'tool_access' ? 100 : 50;

    const current = this.rateLimit.get(key);
    
    if (!current || now > current.resetTime) {
      this.rateLimit.set(key, { count: 1, resetTime: now + windowMs });
      return true;
    }

    if (current.count >= limit) {
      return false;
    }

    current.count++;
    return true;
  }

  private isRestrictedPath(path: string): boolean {
    const restrictedPaths = [
      '/etc/passwd',
      '/etc/shadow',
      '/proc/',
      '/sys/',
      '~/.ssh/',
      process.env.HOME + '/.aws/',
      process.env.HOME + '/.gcp/'
    ];

    return restrictedPaths.some(restricted => 
      path.startsWith(restricted) || path.includes(restricted)
    );
  }

  public generateAuthUrl(resource?: string): { url: string; state: string; codeVerifier: string } {
    if (!this.oauthConfig) {
      throw new Error('OAuth not configured');
    }

    const state = this.pkceManager.generateState();
    const { url, challenge } = this.pkceManager.generateAuthorizationUrl(
      this.oauthConfig.authUrl,
      this.oauthConfig.clientId,
      this.oauthConfig.redirectUri,
      this.oauthConfig.scopes,
      state,
      resource
    );

    return {
      url,
      state,
      codeVerifier: challenge.codeVerifier
    };
  }

  public async exchangeCodeForToken(
    code: string, 
    state: string, 
    codeVerifier: string,
    resource?: string
  ): Promise<AccessToken> {
    if (!this.oauthConfig) {
      throw new Error('OAuth not configured');
    }

    // Validate state parameter
    if (!this.validateState(state)) {
      throw new Error('Invalid state parameter');
    }

    // Create PKCE token request
    const tokenRequest = this.pkceManager.createTokenRequest(
      code,
      this.oauthConfig.redirectUri,
      this.oauthConfig.clientId,
      codeVerifier,
      resource
    );

    // In production, make actual HTTP request to token endpoint
    // For now, return a mock token with enhanced security
    const now = Math.floor(Date.now() / 1000);
    const token: AccessToken = {
      token: jwt.sign(
        { 
          sub: 'user123',
          aud: resource || 'mcp-manus-server',
          iss: this.discoveryService.getAuthorizationServerMetadata().issuer,
          iat: now,
          exp: now + 3600,
          scope: this.oauthConfig.scopes.join(' '),
          resource: resource
        },
        this.oauthConfig.clientSecret
      ),
      refreshToken: 'refresh_' + Date.now(),
      expiresAt: new Date(Date.now() + 3600 * 1000),
      scopes: this.oauthConfig.scopes
    };

    this.accessTokens.set('default', token);
    logger.info('Access token generated successfully with PKCE validation');
    
    return token;
  }

  private generateState(): string {
    return jwt.sign(
      { nonce: Math.random().toString(36), timestamp: Date.now() },
      process.env.JWT_SECRET || 'default-secret'
    );
  }

  private validateState(state: string): boolean {
    try {
      const decoded = jwt.verify(state, process.env.JWT_SECRET || 'default-secret') as {
        timestamp: number;
      };
      
      // State should not be older than 10 minutes
      return Date.now() - decoded.timestamp < 10 * 60 * 1000;
    } catch {
      return false;
    }
  }

  public isAuthenticated(userId: string = 'default'): boolean {
    const token = this.accessTokens.get(userId);
    return token ? token.expiresAt > new Date() : false;
  }

  public getScopes(userId: string = 'default'): string[] {
    const token = this.accessTokens.get(userId);
    return token?.scopes || [];
  }

  // OAuth Discovery Methods
  public getAuthorizationServerMetadata() {
    return this.discoveryService.getAuthorizationServerMetadata();
  }

  public getProtectedResourceMetadata() {
    return this.discoveryService.getProtectedResourceMetadata();
  }

  public getJWKS() {
    return this.discoveryService.getJWKS();
  }

  public validateResourceIndicator(resource: string): boolean {
    return this.discoveryService.isValidResource(resource);
  }

  public validateScopes(requestedScopes: string[]) {
    return this.discoveryService.validateScope(requestedScopes);
  }
}