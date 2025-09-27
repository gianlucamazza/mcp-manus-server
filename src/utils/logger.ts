import winston from 'winston';
import { AsyncLocalStorage } from 'async_hooks';
import { v4 as uuidv4 } from 'uuid';

// Async Local Storage for correlation context
export const correlationContext = new AsyncLocalStorage<{
  correlationId: string;
  requestId: string;
  sessionId?: string;
  userId?: string;
  traceId?: string;
  spanId?: string;
}>();

// Enhanced log format with correlation IDs
const logFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    const context = correlationContext.getStore();
    return JSON.stringify({
      timestamp,
      level,
      message,
      correlationId: context?.correlationId,
      requestId: context?.requestId,
      sessionId: context?.sessionId,
      userId: context?.userId,
      traceId: context?.traceId,
      spanId: context?.spanId,
      service: 'mcp-manus-server',
      ...meta
    });
  })
);

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  defaultMeta: { service: 'mcp-manus-server' },
  transports: [
    new winston.transports.File({ 
      filename: 'logs/error.log', 
      level: 'error',
      maxsize: 5242880,
      maxFiles: 5
    }),
    new winston.transports.File({ 
      filename: 'logs/combined.log',
      maxsize: 5242880,
      maxFiles: 5
    }),
  ],
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    )
  }));
}

// Correlation ID utilities
export const generateCorrelationId = (): string => uuidv4();
export const generateRequestId = (): string => `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
export const generateTraceId = (): string => `trace_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
export const generateSpanId = (): string => `span_${Math.random().toString(36).substr(2, 9)}`;

// Context management
export const setCorrelationContext = (context: {
  correlationId?: string;
  requestId?: string;
  sessionId?: string;
  userId?: string;
  traceId?: string;
  spanId?: string;
}) => {
  const fullContext = {
    correlationId: context.correlationId || generateCorrelationId(),
    requestId: context.requestId || generateRequestId(),
    ...context
  };
  
  return correlationContext.run(fullContext, () => fullContext);
};

export const getCorrelationContext = () => correlationContext.getStore();

export const runWithCorrelation = <T>(
  context: Parameters<typeof setCorrelationContext>[0],
  fn: () => T
): T => {
  return correlationContext.run({
    correlationId: context.correlationId || generateCorrelationId(),
    requestId: context.requestId || generateRequestId(),
    ...context
  }, fn);
};

// Enhanced logging functions with automatic correlation
export const createRequestLogger = (requestId?: string) => {
  const context = correlationContext.getStore();
  return logger.child({ 
    requestId: requestId || context?.requestId,
    correlationId: context?.correlationId 
  });
};

export const logMCPOperation = (operation: string, data: unknown, metadata?: Record<string, any>): void => {
  const context = correlationContext.getStore();
  
  logger.info('MCP Operation', {
    operation,
    operationType: 'mcp_protocol',
    data: typeof data === 'object' ? JSON.stringify(data) : data,
    correlationId: context?.correlationId,
    requestId: context?.requestId,
    traceId: context?.traceId,
    duration: metadata?.duration,
    ...metadata
  });
};

export const logSecurityEvent = (event: string, details: unknown, severity: 'low' | 'medium' | 'high' | 'critical' = 'high'): void => {
  const context = correlationContext.getStore();
  
  logger.warn('Security Event', {
    event,
    eventType: 'security',
    details,
    severity,
    correlationId: context?.correlationId,
    requestId: context?.requestId,
    userId: context?.userId,
    requiresInvestigation: severity === 'critical'
  });
};

export const logHTTPRequest = (
  method: string, 
  url: string, 
  statusCode: number, 
  duration: number, 
  metadata?: Record<string, any>
): void => {
  const context = correlationContext.getStore();
  
  logger.info('HTTP Request', {
    method,
    url,
    statusCode,
    duration,
    requestType: 'http',
    correlationId: context?.correlationId,
    requestId: context?.requestId,
    userAgent: metadata?.userAgent,
    ip: metadata?.ip,
    ...metadata
  });
};

export const logOAuthOperation = (
  operation: string,
  clientId: string,
  status: 'success' | 'failure',
  metadata?: Record<string, any>
): void => {
  const context = correlationContext.getStore();
  
  logger.info('OAuth Operation', {
    operation,
    operationType: 'oauth',
    clientId,
    status,
    correlationId: context?.correlationId,
    requestId: context?.requestId,
    sessionId: context?.sessionId,
    ...metadata
  });
};

export const logManusAPICall = (
  endpoint: string,
  method: string,
  statusCode: number,
  duration: number,
  metadata?: Record<string, any>
): void => {
  const context = correlationContext.getStore();
  
  logger.info('Manus API Call', {
    endpoint,
    method,
    statusCode,
    duration,
    requestType: 'external_api',
    provider: 'manus',
    correlationId: context?.correlationId,
    requestId: context?.requestId,
    traceId: context?.traceId,
    ...metadata
  });
};

export const logError = (
  error: Error | string,
  context?: string,
  metadata?: Record<string, any>
): void => {
  const correlationCtx = correlationContext.getStore();
  
  logger.error('Application Error', {
    error: error instanceof Error ? error.message : error,
    errorType: error instanceof Error ? error.constructor.name : 'GenericError',
    stack: error instanceof Error ? error.stack : undefined,
    context,
    correlationId: correlationCtx?.correlationId,
    requestId: correlationCtx?.requestId,
    traceId: correlationCtx?.traceId,
    ...metadata
  });
};

export const logMetric = (
  metricName: string,
  value: number,
  unit: string,
  metadata?: Record<string, any>
): void => {
  const context = correlationContext.getStore();
  
  logger.info('Metric', {
    metricName,
    value,
    unit,
    metricType: 'custom',
    correlationId: context?.correlationId,
    requestId: context?.requestId,
    ...metadata
  });
};