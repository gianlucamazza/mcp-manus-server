import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { AuthManager } from '../auth/manager.js';
import { logger } from '../utils/logger.js';

export async function registerDiscoveryRoutes(
  fastify: FastifyInstance,
  authManager: AuthManager
): Promise<void> {
  
  // OAuth 2.1 Authorization Server Metadata
  // RFC 8414: OAuth 2.0 Authorization Server Metadata
  fastify.get('/.well-known/oauth-authorization-server', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const metadata = authManager.getAuthorizationServerMetadata();
      
      reply
        .type('application/json')
        .header('Cache-Control', 'public, max-age=3600')
        .send(metadata);
        
      logger.info('OAuth authorization server metadata requested', {
        ip: request.ip,
        userAgent: request.headers['user-agent']
      });
      
    } catch (error) {
      logger.error('Failed to serve authorization server metadata:', error);
      reply.code(500).send({ error: 'Internal Server Error' });
    }
  });

  // OAuth 2.1 Protected Resource Metadata
  // RFC 8707: Resource Indicators for OAuth 2.0
  fastify.get('/.well-known/oauth-protected-resource', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const metadata = authManager.getProtectedResourceMetadata();
      
      reply
        .type('application/json')
        .header('Cache-Control', 'public, max-age=3600')
        .send(metadata);
        
      logger.info('OAuth protected resource metadata requested', {
        ip: request.ip,
        userAgent: request.headers['user-agent']
      });
      
    } catch (error) {
      logger.error('Failed to serve protected resource metadata:', error);
      reply.code(500).send({ error: 'Internal Server Error' });
    }
  });

  // JSON Web Key Set
  // RFC 7517: JSON Web Key (JWK)
  fastify.get('/.well-known/jwks.json', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const jwks = authManager.getJWKS();
      
      reply
        .type('application/json')
        .header('Cache-Control', 'public, max-age=86400') // Cache for 24 hours
        .send(jwks);
        
      logger.info('JWKS requested', {
        ip: request.ip,
        userAgent: request.headers['user-agent']
      });
      
    } catch (error) {
      logger.error('Failed to serve JWKS:', error);
      reply.code(500).send({ error: 'Internal Server Error' });
    }
  });

  // OAuth Authorization Endpoint
  fastify.get('/oauth/authorize', async (request: FastifyRequest, reply: FastifyReply) => {
    interface AuthorizeQuery {
      response_type?: string;
      client_id?: string;
      redirect_uri?: string;
      scope?: string;
      state?: string;
      code_challenge?: string;
      code_challenge_method?: string;
      resource?: string;
    }
    
    try {
      const query = request.query as AuthorizeQuery;
      
      // Validate required parameters
      if (!query.client_id || !query.redirect_uri || !query.response_type) {
        return reply.code(400).send({
          error: 'invalid_request',
          error_description: 'Missing required parameters'
        });
      }
      
      // Validate response type (OAuth 2.1 only allows 'code')
      if (query.response_type !== 'code') {
        return reply.code(400).send({
          error: 'unsupported_response_type',
          error_description: 'Only authorization code flow is supported'
        });
      }
      
      // Validate PKCE parameters (required in OAuth 2.1)
      if (!query.code_challenge || query.code_challenge_method !== 'S256') {
        return reply.code(400).send({
          error: 'invalid_request',
          error_description: 'PKCE with S256 method is required'
        });
      }
      
      // Validate resource indicator if provided
      if (query.resource && !authManager.validateResourceIndicator(query.resource)) {
        return reply.code(400).send({
          error: 'invalid_target',
          error_description: 'Invalid resource indicator'
        });
      }
      
      // Validate scopes
      const requestedScopes = query.scope ? query.scope.split(' ') : [];
      const scopeValidation = authManager.validateScopes(requestedScopes);
      
      if (scopeValidation.invalid.length > 0) {
        return reply.code(400).send({
          error: 'invalid_scope',
          error_description: `Unsupported scopes: ${scopeValidation.invalid.join(', ')}`
        });
      }
      
      logger.info('OAuth authorization request received', {
        client_id: query.client_id,
        scopes: requestedScopes,
        resource: query.resource,
        ip: request.ip
      });
      
      // In a real implementation, this would redirect to a consent page
      // For this demo, we'll return a mock authorization code
      const authCode = 'mock_auth_code_' + Date.now();
      const redirectUrl = new URL(query.redirect_uri);
      redirectUrl.searchParams.set('code', authCode);
      if (query.state) {
        redirectUrl.searchParams.set('state', query.state);
      }
      
      reply.redirect(302, redirectUrl.toString());
      
    } catch (error) {
      logger.error('OAuth authorization error:', error);
      reply.code(500).send({
        error: 'server_error',
        error_description: 'Internal server error'
      });
    }
  });

  // OAuth Token Endpoint
  fastify.post('/oauth/token', async (request: FastifyRequest, reply: FastifyReply) => {
    interface TokenRequest {
      grant_type?: string;
      code?: string;
      redirect_uri?: string;
      client_id?: string;
      code_verifier?: string;
      resource?: string;
      refresh_token?: string;
    }
    
    try {
      const body = request.body as TokenRequest;
      
      // Validate grant type
      if (!body.grant_type || !['authorization_code', 'refresh_token'].includes(body.grant_type)) {
        return reply.code(400).send({
          error: 'unsupported_grant_type',
          error_description: 'Only authorization_code and refresh_token are supported'
        });
      }
      
      if (body.grant_type === 'authorization_code') {
        // Validate authorization code flow parameters
        if (!body.code || !body.client_id || !body.code_verifier) {
          return reply.code(400).send({
            error: 'invalid_request',
            error_description: 'Missing required parameters for authorization code flow'
          });
        }
        
        // Validate resource indicator if provided
        if (body.resource && !authManager.validateResourceIndicator(body.resource)) {
          return reply.code(400).send({
            error: 'invalid_target',
            error_description: 'Invalid resource indicator'
          });
        }
        
        logger.info('OAuth token request (authorization code)', {
          client_id: body.client_id,
          resource: body.resource,
          ip: request.ip
        });
        
        // In a real implementation, validate the authorization code and PKCE verifier
        // For this demo, return a mock token
        const tokenResponse = {
          access_token: 'mock_access_token_' + Date.now(),
          token_type: 'Bearer',
          expires_in: 3600,
          refresh_token: 'mock_refresh_token_' + Date.now(),
          scope: 'read write',
          resource: body.resource
        };
        
        reply.send(tokenResponse);
        
      } else if (body.grant_type === 'refresh_token') {
        // Handle refresh token flow
        if (!body.refresh_token) {
          return reply.code(400).send({
            error: 'invalid_request',
            error_description: 'Missing refresh_token parameter'
          });
        }
        
        logger.info('OAuth token refresh', {
          ip: request.ip
        });
        
        const tokenResponse = {
          access_token: 'mock_refreshed_token_' + Date.now(),
          token_type: 'Bearer',
          expires_in: 3600,
          scope: 'read write'
        };
        
        reply.send(tokenResponse);
      }
      
    } catch (error) {
      logger.error('OAuth token error:', error);
      reply.code(500).send({
        error: 'server_error',
        error_description: 'Internal server error'
      });
    }
  });

  // OAuth Revocation Endpoint
  // RFC 7009: OAuth 2.0 Token Revocation
  fastify.post('/oauth/revoke', async (request: FastifyRequest, reply: FastifyReply) => {
    interface RevokeRequest {
      token?: string;
      token_type_hint?: 'access_token' | 'refresh_token';
    }
    
    try {
      const body = request.body as RevokeRequest;
      
      if (!body.token) {
        return reply.code(400).send({
          error: 'invalid_request',
          error_description: 'Missing token parameter'
        });
      }
      
      logger.info('OAuth token revocation', {
        token_type_hint: body.token_type_hint,
        ip: request.ip
      });
      
      // In a real implementation, revoke the token
      reply.code(200).send({});
      
    } catch (error) {
      logger.error('OAuth revocation error:', error);
      reply.code(500).send({
        error: 'server_error',
        error_description: 'Internal server error'
      });
    }
  });
}