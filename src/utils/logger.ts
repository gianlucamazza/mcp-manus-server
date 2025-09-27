import winston from 'winston';

const logFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    return JSON.stringify({
      timestamp,
      level,
      message,
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

export const createRequestLogger = (requestId: string) => {
  return logger.child({ requestId });
};

export const logMCPOperation = (operation: string, data: unknown): void => {
  logger.info('MCP Operation', {
    operation,
    data: typeof data === 'object' ? JSON.stringify(data) : data,
    timestamp: new Date().toISOString()
  });
};

export const logSecurityEvent = (event: string, details: unknown): void => {
  logger.warn('Security Event', {
    event,
    details,
    timestamp: new Date().toISOString(),
    severity: 'high'
  });
};