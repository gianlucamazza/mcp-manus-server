#!/bin/sh

# Health check script for MCP server
# This script verifies that the MCP server is responsive

set -e

# Function to log messages
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] HEALTHCHECK: $1"
}

# Check if the server process is running
if ! pgrep -f "node.*index.js" > /dev/null; then
    log "ERROR: MCP server process not found"
    exit 1
fi

# Check memory usage (fail if using more than 90% of available memory)
MEMORY_USAGE=$(ps -o pid,ppid,cmd,%mem --sort=-%mem | grep "node.*index.js" | head -1 | awk '{print $4}' | cut -d. -f1)

if [ -n "$MEMORY_USAGE" ] && [ "$MEMORY_USAGE" -gt 90 ]; then
    log "WARNING: High memory usage: ${MEMORY_USAGE}%"
    # Don't fail on high memory usage, just warn
fi

# Check if logs directory is writable
if [ ! -w "/app/logs" ]; then
    log "ERROR: Logs directory is not writable"
    exit 1
fi

# Check for recent log activity (logs should be written within last 5 minutes)
if [ -f "/app/logs/combined.log" ]; then
    LAST_LOG=$(find /app/logs/combined.log -mmin -5 2>/dev/null | wc -l)
    if [ "$LAST_LOG" -eq 0 ]; then
        log "WARNING: No recent log activity detected"
        # Don't fail on this, as server might be idle
    fi
fi

# If we reach here, the health check passed
log "Health check passed"
exit 0