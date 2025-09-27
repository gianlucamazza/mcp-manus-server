import { z } from 'zod';

// MCP Core Types
export interface MCPServerConfig {
  name: string;
  version: string;
  capabilities: {
    resources?: boolean;
    tools?: boolean;
    prompts?: boolean;
    logging?: boolean;
  };
}

// Manus.im Integration Types
export const ManusCreditsSchema = z.object({
  total: z.number(),
  used: z.number(),
  remaining: z.number(),
  dailyLimit: z.number(),
  resetTime: z.string().datetime()
});

export const ManusTaskSchema = z.object({
  id: z.string(),
  type: z.enum(['text', 'image', 'code', 'file', 'web']),
  status: z.enum(['pending', 'running', 'completed', 'failed']),
  input: z.any(),
  output: z.any().optional(),
  creditsUsed: z.number(),
  createdAt: z.string().datetime(),
  completedAt: z.string().datetime().optional()
});

export const ManusApiResponseSchema = z.object({
  success: z.boolean(),
  data: z.any().optional(),
  error: z.string().optional(),
  creditsUsed: z.number().optional()
});

// OAuth 2.1 Types
export interface OAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  authUrl: string;
  tokenUrl: string;
  scopes: string[];
}

export interface AccessToken {
  token: string;
  refreshToken?: string;
  expiresAt: Date;
  scopes: string[];
}

// Security Types
export interface SecurityContext {
  userId: string;
  permissions: string[];
  rateLimit: {
    requests: number;
    windowMs: number;
  };
}

// Tool Types
export interface MCPTool {
  name: string;
  description: string;
  inputSchema: z.ZodSchema;
  handler: (input: unknown, context: SecurityContext) => Promise<unknown>;
}

// Resource Types
export interface MCPResource {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
  text?: string;
  blob?: Uint8Array;
}

export type ManusCredits = z.infer<typeof ManusCreditsSchema>;
export type ManusTask = z.infer<typeof ManusTaskSchema>;
export type ManusApiResponse = z.infer<typeof ManusApiResponseSchema>;