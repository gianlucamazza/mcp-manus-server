#!/usr/bin/env node

import { MCPManusServer } from './server/index.js';
import { HTTPServer } from './server/http.js';
import { logger } from './utils/logger.js';
import { MCPServerConfig } from './types/index.js';
import { configManager } from './utils/config.js';

async function main(): Promise<void> {
  try {
    // Ensure logs directory exists
    const fs = await import('fs');
    const path = await import('path');
    
    const logsDir = path.join(process.cwd(), 'logs');
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }

    // Server configuration
    const config: MCPServerConfig = {
      name: 'mcp-manus-server',
      version: '1.0.0',
      capabilities: {
        resources: true,
        tools: true,
        prompts: false,
        logging: true
      }
    };

    // Initialize servers
    const mcpServer = new MCPManusServer(config);
    const httpServer = new HTTPServer();
    
    logger.info('='.repeat(50));
    logger.info('MCP Manus Server Starting...');
    logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
    logger.info(`Node Version: ${process.version}`);
    logger.info(`Platform: ${process.platform}`);
    logger.info(`HTTP Port: ${configManager.get('PORT')}`);
    logger.info(`Metrics Enabled: ${configManager.get('METRICS_ENABLED')}`);
    logger.info('='.repeat(50));

    // Start HTTP server (for metrics, health checks, OAuth)
    await httpServer.start();

    // Start MCP server (stdio transport)
    await mcpServer.start();

  } catch (error) {
    logger.error('Fatal error starting server:', error);
    process.exit(1);
  }
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

// Start the server
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    logger.error('Failed to start server:', error);
    process.exit(1);
  });
}