# Multi-stage build for security and optimization
FROM node:20-alpine AS builder

# Create app directory
WORKDIR /app

# Install dependencies for building
COPY package*.json ./
RUN npm ci --only=production

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Production stage
FROM node:20-alpine AS production

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S mcpuser -u 1001 -G nodejs

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install only production dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy built application from builder stage
COPY --from=builder /app/dist ./dist

# Create logs directory with proper permissions
RUN mkdir -p logs && chown -R mcpuser:nodejs logs

# Security: Remove unnecessary packages and files
RUN apk del --purge \
    && rm -rf /var/cache/apk/* \
    && rm -rf /tmp/* \
    && rm -rf /var/tmp/* \
    && rm -rf /root/.npm

# Copy health check script
COPY --chown=mcpuser:nodejs docker/healthcheck.sh /usr/local/bin/healthcheck.sh
RUN chmod +x /usr/local/bin/healthcheck.sh

# Security hardening
RUN chown -R mcpuser:nodejs /app
USER mcpuser

# Expose port (if using HTTP transport)
EXPOSE 3000

# Add labels for metadata
LABEL maintainer="Gianluca Mazza" \
      version="1.0.0" \
      description="MCP Server with Manus.im integration" \
      security.scan="enabled"

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD /usr/local/bin/healthcheck.sh

# Resource limits (can be overridden at runtime)
ENV NODE_ENV=production
ENV LOG_LEVEL=info

# Start the application
CMD ["node", "dist/index.js"]