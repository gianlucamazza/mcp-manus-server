import { z } from 'zod';

export interface OAuthDiscoveryMetadata {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  response_types_supported: string[];
  grant_types_supported: string[];
  code_challenge_methods_supported: string[];
  scopes_supported: string[];
  token_endpoint_auth_methods_supported: string[];
  resource_indicators_supported?: boolean;
  resource_documentation?: string;
}

export interface ResourceServerMetadata {
  resource: string;
  authorization_servers: string[];
  scopes_supported: string[];
  bearer_methods_supported: string[];
  resource_documentation?: string;
  resource_policy_uri?: string;
  resource_tos_uri?: string;
}

export const OAuthDiscoverySchema = z.object({
  issuer: z.string().url(),
  authorization_endpoint: z.string().url(),
  token_endpoint: z.string().url(),
  response_types_supported: z.array(z.string()),
  grant_types_supported: z.array(z.string()),
  code_challenge_methods_supported: z.array(z.string()),
  scopes_supported: z.array(z.string()),
  token_endpoint_auth_methods_supported: z.array(z.string()),
  resource_indicators_supported: z.boolean().optional(),
  resource_documentation: z.string().url().optional()
});

export const ResourceServerSchema = z.object({
  resource: z.string().url(),
  authorization_servers: z.array(z.string().url()),
  scopes_supported: z.array(z.string()),
  bearer_methods_supported: z.array(z.string()),
  resource_documentation: z.string().url().optional(),
  resource_policy_uri: z.string().url().optional(),
  resource_tos_uri: z.string().url().optional()
});

export class OAuthDiscoveryService {
  private baseUrl: string;
  private resourceIdentifier: string;

  constructor(baseUrl: string, resourceIdentifier: string) {
    this.baseUrl = baseUrl.replace(/\/$/, ''); // Remove trailing slash
    this.resourceIdentifier = resourceIdentifier;
  }

  /**
   * Generate OAuth 2.1 Authorization Server Metadata
   * RFC 8414: OAuth 2.0 Authorization Server Metadata
   */
  public getAuthorizationServerMetadata(): OAuthDiscoveryMetadata {
    const metadata: OAuthDiscoveryMetadata = {
      issuer: this.baseUrl,
      authorization_endpoint: `${this.baseUrl}/oauth/authorize`,
      token_endpoint: `${this.baseUrl}/oauth/token`,
      response_types_supported: ['code'],
      grant_types_supported: ['authorization_code', 'refresh_token'],
      code_challenge_methods_supported: ['S256'],
      scopes_supported: ['read', 'write', 'admin'],
      token_endpoint_auth_methods_supported: ['none', 'client_secret_post'],
      resource_indicators_supported: true,
      resource_documentation: `${this.baseUrl}/docs/oauth`
    };

    // Validate the metadata
    OAuthDiscoverySchema.parse(metadata);
    
    return metadata;
  }

  /**
   * Generate OAuth 2.1 Protected Resource Metadata
   * RFC 8707: Resource Indicators for OAuth 2.0
   */
  public getProtectedResourceMetadata(): ResourceServerMetadata {
    const metadata: ResourceServerMetadata = {
      resource: this.resourceIdentifier,
      authorization_servers: [this.baseUrl],
      scopes_supported: ['read', 'write', 'admin'],
      bearer_methods_supported: ['header', 'body', 'query'],
      resource_documentation: `${this.baseUrl}/docs/api`,
      resource_policy_uri: `${this.baseUrl}/privacy-policy`,
      resource_tos_uri: `${this.baseUrl}/terms-of-service`
    };

    // Validate the metadata
    ResourceServerSchema.parse(metadata);
    
    return metadata;
  }

  /**
   * Generate JWK Set for token verification
   * RFC 7517: JSON Web Key (JWK)
   */
  public getJWKS(): { keys: Array<Record<string, unknown>> } {
    // In production, this should return actual public keys
    // For now, return empty set as we're using symmetric keys
    return {
      keys: [
        // Example JWK structure (should be replaced with actual keys)
        {
          kty: 'RSA',
          use: 'sig',
          kid: 'mcp-manus-2025',
          alg: 'RS256',
          // In production, include actual key material
          // n: 'public_key_modulus',
          // e: 'public_key_exponent'
        }
      ]
    };
  }

  /**
   * Validate that a resource URI matches our protected resource
   */
  public isValidResource(resourceUri: string): boolean {
    try {
      const url = new URL(resourceUri);
      const expectedUrl = new URL(this.resourceIdentifier);
      
      return url.origin === expectedUrl.origin;
    } catch {
      return false;
    }
  }

  /**
   * Get all well-known endpoints that should be exposed
   */
  public getWellKnownEndpoints(): Record<string, string> {
    return {
      '/.well-known/oauth-authorization-server': `${this.baseUrl}/.well-known/oauth-authorization-server`,
      '/.well-known/oauth-protected-resource': `${this.baseUrl}/.well-known/oauth-protected-resource`,
      '/.well-known/jwks.json': `${this.baseUrl}/.well-known/jwks.json`
    };
  }

  /**
   * Validate scope against supported scopes
   */
  public validateScope(requestedScopes: string[]): { valid: string[]; invalid: string[] } {
    const supportedScopes = this.getAuthorizationServerMetadata().scopes_supported;
    
    const valid = requestedScopes.filter(scope => supportedScopes.includes(scope));
    const invalid = requestedScopes.filter(scope => !supportedScopes.includes(scope));
    
    return { valid, invalid };
  }

  /**
   * Check if client supports required OAuth 2.1 features
   */
  public validateClientCapabilities(clientMetadata: {
    code_challenge_method?: string;
    response_types?: string[];
    grant_types?: string[];
  }): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    // PKCE is required in OAuth 2.1
    if (!clientMetadata.code_challenge_method || clientMetadata.code_challenge_method !== 'S256') {
      errors.push('PKCE with S256 method is required');
    }
    
    // Only code flow is allowed in OAuth 2.1
    if (clientMetadata.response_types && 
        !clientMetadata.response_types.every(type => type === 'code')) {
      errors.push('Only authorization code flow is supported');
    }
    
    // Validate grant types
    const allowedGrantTypes = ['authorization_code', 'refresh_token'];
    if (clientMetadata.grant_types && 
        !clientMetadata.grant_types.every(type => allowedGrantTypes.includes(type))) {
      errors.push('Unsupported grant type');
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Generate OAuth 2.1 compliant error responses
   */
  public createErrorResponse(error: string, description?: string, uri?: string): {
    error: string;
    error_description?: string;
    error_uri?: string;
  } {
    const response: { error: string; error_description?: string; error_uri?: string } = {
      error
    };
    
    if (description) {
      response.error_description = description;
    }
    
    if (uri) {
      response.error_uri = uri;
    }
    
    return response;
  }
}