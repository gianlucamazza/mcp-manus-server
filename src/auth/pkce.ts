import crypto from 'crypto';
import { z } from 'zod';

export interface PKCEChallenge {
  codeChallenge: string;
  codeChallengeMethod: 'S256';
  codeVerifier: string;
}

export interface PKCETokenRequest {
  grant_type: 'authorization_code';
  code: string;
  redirect_uri: string;
  client_id: string;
  code_verifier: string;
  resource?: string;
}

export const PKCEChallengeSchema = z.object({
  codeChallenge: z.string().min(43).max(128),
  codeChallengeMethod: z.literal('S256'),
  codeVerifier: z.string().min(43).max(128)
});

export const PKCETokenRequestSchema = z.object({
  grant_type: z.literal('authorization_code'),
  code: z.string(),
  redirect_uri: z.string().url(),
  client_id: z.string(),
  code_verifier: z.string().min(43).max(128),
  resource: z.string().url().optional()
});

export class PKCEManager {
  private challenges = new Map<string, PKCEChallenge>();
  
  /**
   * Generate a cryptographically secure random string for PKCE
   */
  private generateRandomString(length: number): string {
    const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
    let result = '';
    const randomBytes = crypto.randomBytes(length);
    
    for (let i = 0; i < length; i++) {
      result += charset[randomBytes[i] % charset.length];
    }
    
    return result;
  }

  /**
   * Create a new PKCE challenge
   */
  public createChallenge(): PKCEChallenge {
    // Generate code verifier (43-128 characters)
    const codeVerifier = this.generateRandomString(128);
    
    // Create code challenge using S256 method
    const codeChallenge = crypto
      .createHash('sha256')
      .update(codeVerifier)
      .digest('base64url');

    const challenge: PKCEChallenge = {
      codeChallenge,
      codeChallengeMethod: 'S256',
      codeVerifier
    };

    // Validate the challenge
    PKCEChallengeSchema.parse(challenge);
    
    // Store challenge temporarily (with expiration)
    const challengeId = crypto.randomUUID();
    this.challenges.set(challengeId, challenge);
    
    // Clean up expired challenges after 10 minutes
    setTimeout(() => {
      this.challenges.delete(challengeId);
    }, 10 * 60 * 1000);

    return challenge;
  }

  /**
   * Verify a PKCE code verifier against the challenge
   */
  public verifyChallenge(codeVerifier: string, codeChallenge: string): boolean {
    try {
      const computedChallenge = crypto
        .createHash('sha256')
        .update(codeVerifier)
        .digest('base64url');
      
      return computedChallenge === codeChallenge;
    } catch (error) {
      return false;
    }
  }

  /**
   * Generate authorization URL with PKCE parameters
   */
  public generateAuthorizationUrl(
    authUrl: string,
    clientId: string,
    redirectUri: string,
    scopes: string[],
    state: string,
    resource?: string
  ): { url: string; challenge: PKCEChallenge } {
    const challenge = this.createChallenge();
    
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: clientId,
      redirect_uri: redirectUri,
      scope: scopes.join(' '),
      state,
      code_challenge: challenge.codeChallenge,
      code_challenge_method: challenge.codeChallengeMethod
    });

    // Add resource parameter for OAuth 2.1 Resource Indicators
    if (resource) {
      params.set('resource', resource);
    }

    return {
      url: `${authUrl}?${params.toString()}`,
      challenge
    };
  }

  /**
   * Exchange authorization code for access token with PKCE
   */
  public createTokenRequest(
    code: string,
    redirectUri: string,
    clientId: string,
    codeVerifier: string,
    resource?: string
  ): PKCETokenRequest {
    const tokenRequest: PKCETokenRequest = {
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: clientId,
      code_verifier: codeVerifier
    };

    // Add resource parameter for OAuth 2.1 Resource Indicators
    if (resource) {
      tokenRequest.resource = resource;
    }

    // Validate the token request
    PKCETokenRequestSchema.parse(tokenRequest);
    
    return tokenRequest;
  }

  /**
   * Clean up expired challenges
   */
  public cleanup(): void {
    // Challenges are automatically cleaned up via setTimeout
    // This method can be used for manual cleanup if needed
    this.challenges.clear();
  }

  /**
   * Get stored challenge by ID (for debugging/testing)
   */
  public getChallenge(challengeId: string): PKCEChallenge | undefined {
    return this.challenges.get(challengeId);
  }

  /**
   * Generate a secure state parameter
   */
  public generateState(): string {
    return crypto.randomBytes(32).toString('base64url');
  }

  /**
   * Validate state parameter format
   */
  public validateStateFormat(state: string): boolean {
    // State should be at least 32 characters and contain only valid base64url characters
    return /^[A-Za-z0-9_-]{32,}$/.test(state);
  }
}