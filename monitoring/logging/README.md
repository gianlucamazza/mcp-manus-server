# MCP Manus Server - Comprehensive Logging System

This directory contains the enterprise-grade logging infrastructure for the MCP Manus Server, implementing 2025 best practices for structured logging, correlation IDs, and log aggregation.

## 🎯 Overview

The logging system provides:
- **Correlation ID tracking** across all components
- **Structured JSON logging** with consistent schema
- **Log aggregation** with Elasticsearch/Kibana stack
- **Distributed tracing** integration with Jaeger
- **Real-time log processing** with Fluent Bit
- **Security event monitoring** and alerting

## 🏗️ Architecture

```text
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   MCP Server    │───▶│   Fluent Bit    │───▶│ Elasticsearch   │
│  (Structured    │    │  (Processing)   │    │  (Storage)      │
│   Logging)      │    └─────────────────┘    └─────────────────┘
└─────────────────┘              │                       │
         │                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│ Correlation IDs │    │    Parsers      │    │     Kibana      │
│ AsyncLocalStorage│    │   Enrichment    │    │ (Visualization) │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 🚀 Quick Start

### 1. Start Logging Stack

```bash
cd monitoring/logging
docker-compose up -d
```

### 2. Access Interfaces

- **Kibana**: http://localhost:5601
- **Elasticsearch**: http://localhost:9200
- **Fluent Bit Monitoring**: http://localhost:2020
- **Jaeger UI**: http://localhost:16686

### 3. View Logs

```bash
# Real-time logs
curl http://localhost:9200/mcp-logs-*/_search?pretty

# Security events
curl http://localhost:9200/mcp-security-events-*/_search?pretty
```

## 📋 Log Schema

### Standard Log Entry

```json
{
  "@timestamp": "2025-01-01T12:00:00.000Z",
  "level": "info",
  "message": "HTTP Request",
  "correlationId": "550e8400-e29b-41d4-a716-446655440000",
  "requestId": "req_1704110400000_abc123def",
  "sessionId": "sess_user123_456789",
  "traceId": "trace_1704110400000_xyz789",
  "spanId": "span_abc123",
  "service": "mcp-manus-server",
  "method": "GET",
  "url": "/health",
  "statusCode": 200,
  "duration": 25,
  "userAgent": "Mozilla/5.0...",
  "ip": "192.168.1.100"
}
```

### MCP Operation Log

```json
{
  "@timestamp": "2025-01-01T12:00:00.000Z",
  "level": "info",
  "message": "MCP Operation",
  "correlationId": "550e8400-e29b-41d4-a716-446655440000",
  "requestId": "req_1704110400000_abc123def",
  "traceId": "trace_1704110400000_xyz789",
  "operation": "call_tool",
  "operationType": "mcp_protocol",
  "operationId": "mcp_call_tool",
  "duration": 150,
  "status": "success",
  "toolName": "get_system_info",
  "data": "{\"name\":\"get_system_info\",\"args\":{}}"
}
```

### Security Event Log

```json
{
  "@timestamp": "2025-01-01T12:00:00.000Z",
  "level": "warn",
  "message": "Security Event",
  "correlationId": "550e8400-e29b-41d4-a716-446655440000",
  "requestId": "req_1704110400000_abc123def",
  "userId": "user123",
  "event": "tool_call_failed",
  "eventType": "security",
  "severity": "high",
  "requiresInvestigation": false,
  "details": {
    "toolName": "restricted_tool",
    "error": "Unauthorized access"
  }
}
```

## 🔍 Correlation ID System

### Implementation

The system uses Node.js `AsyncLocalStorage` to maintain correlation context across:
- HTTP requests
- MCP protocol operations
- External API calls
- Database operations
- Background tasks

### Usage in Code

```typescript
import { 
  runWithCorrelation, 
  generateCorrelationId,
  logMCPOperation 
} from '../utils/logger.js';

// Automatic correlation for HTTP requests
app.use((req, res, next) => {
  runWithCorrelation({
    correlationId: req.headers['x-correlation-id'] || generateCorrelationId(),
    requestId: generateRequestId(),
    sessionId: req.session?.id,
    userId: req.user?.id
  }, () => {
    next();
  });
});

// Manual correlation for background tasks
runWithCorrelation({
  correlationId: generateCorrelationId(),
  traceId: generateTraceId()
}, async () => {
  await performBackgroundTask();
  logMCPOperation('background_task', { status: 'completed' });
});
```

### Propagation Headers

The system automatically handles these headers:
- `x-correlation-id`: Unique request correlation ID
- `x-request-id`: HTTP request identifier
- `x-session-id`: User session identifier
- `x-trace-id`: Distributed tracing identifier

## 📊 Log Types and Categories

### 1. HTTP Request Logs
- All HTTP requests/responses
- Performance metrics
- Client information
- Error tracking

### 2. MCP Protocol Logs
- Tool calls and responses
- Resource access
- Protocol errors
- Operation timing

### 3. Security Logs
- Authentication events
- Authorization failures
- Security policy violations
- Suspicious activities

### 4. OAuth Logs
- Authorization attempts
- Token exchanges
- Client validation
- Flow completions

### 5. External API Logs
- Manus.im API calls
- Third-party integrations
- Response times
- Error handling

### 6. System Logs
- Application startup/shutdown
- Configuration changes
- Health checks
- Performance metrics

## 🔧 Configuration

### Environment Variables

```bash
# Elasticsearch Configuration
ELASTICSEARCH_HOST=elasticsearch
ELASTICSEARCH_PORT=9200
ELASTICSEARCH_USER=elastic
ELASTICSEARCH_PASSWORD=changeme

# Log Levels
LOG_LEVEL=info  # debug, info, warn, error

# Correlation Settings
ENABLE_CORRELATION_IDS=true
CORRELATION_HEADER_NAME=x-correlation-id

# Log Retention
LOG_RETENTION_DAYS=30
LOG_ROTATION_SIZE=100MB
```

### Fluent Bit Configuration

The system uses Fluent Bit for:
- **Input**: File tailing, Docker logs, Forward protocol
- **Processing**: JSON parsing, correlation enrichment
- **Output**: Elasticsearch, Prometheus metrics, File backup

### Kibana Dashboards

Pre-configured dashboards for:
- **Overview**: Request rates, response times, error rates
- **Security**: Security events, failed authentications
- **Performance**: Operation timing, resource usage
- **Debugging**: Correlation tracing, error analysis

## 🔍 Querying Logs

### Elasticsearch Queries

```bash
# Find all logs for a correlation ID
curl -X GET "localhost:9200/mcp-logs-*/_search" -H 'Content-Type: application/json' -d'
{
  "query": {
    "term": {
      "correlationId": "550e8400-e29b-41d4-a716-446655440000"
    }
  }
}'

# Security events in last hour
curl -X GET "localhost:9200/mcp-security-events-*/_search" -H 'Content-Type: application/json' -d'
{
  "query": {
    "range": {
      "@timestamp": {
        "gte": "now-1h"
      }
    }
  }
}'

# Failed operations
curl -X GET "localhost:9200/mcp-logs-*/_search" -H 'Content-Type: application/json' -d'
{
  "query": {
    "bool": {
      "must": [
        {"term": {"operationType": "mcp_protocol"}},
        {"term": {"status": "error"}}
      ]
    }
  }
}'
```

### Kibana Queries (KQL)

```
# All logs for a request
requestId: "req_1704110400000_abc123def"

# Security events by severity
eventType: "security" AND severity: "critical"

# Slow operations
operationType: "mcp_protocol" AND duration > 1000

# OAuth failures
operationType: "oauth" AND status: "failure"

# API errors
requestType: "external_api" AND statusCode >= 400
```

## 📈 Monitoring and Alerting

### Prometheus Metrics

Fluent Bit exports log-based metrics:
- Log volume by level
- Error rates by operation
- Security event counts
- Correlation ID usage

### Alerts Configuration

```yaml
# High error rate alert
- alert: HighLogErrorRate
  expr: rate(fluentbit_output_errors_total[5m]) > 0.1
  for: 2m
  labels:
    severity: warning
  annotations:
    summary: "High log processing error rate"

# Security events alert
- alert: SecurityEventDetected
  expr: increase(log_security_events_total[5m]) > 0
  for: 0m
  labels:
    severity: critical
  annotations:
    summary: "Security event detected"
```

## 🔒 Security and Compliance

### Data Protection
- **No PII Logging**: Personal data is never logged
- **Secret Sanitization**: Automatic secret detection and masking
- **Encrypted Storage**: Elasticsearch encryption at rest
- **Access Control**: Role-based access to log data

### Compliance
- **Audit Trail**: Complete operation tracking
- **Data Retention**: Configurable retention policies
- **Export Capabilities**: GDPR compliance support
- **Monitoring**: Access logging and alerting

## 🛠️ Maintenance

### Log Rotation

```bash
# Manual rotation
docker exec mcp-fluent-bit kill -USR1 1

# Cleanup old logs
find logs/ -name "*.log" -mtime +30 -delete
```

### Performance Tuning

```yaml
# Fluent Bit memory optimization
[SERVICE]
    storage.path              /tmp/flb-storage/
    storage.sync              normal
    storage.backlog.mem_limit 5M

# Elasticsearch optimization
ES_JAVA_OPTS: "-Xms2g -Xmx2g"
```

### Troubleshooting

```bash
# Check Fluent Bit status
curl http://localhost:2020/api/v1/health

# Elasticsearch cluster health
curl http://localhost:9200/_cluster/health

# Recent error logs
docker logs mcp-fluent-bit --tail 100

# Test log parsing
echo '{"test": "message"}' | docker exec -i mcp-fluent-bit fluent-bit -i stdin -o stdout -p format=json_lines
```

## 🚀 Production Deployment

### Scaling
- **Multiple Fluent Bit instances** for high availability
- **Elasticsearch cluster** for storage redundancy
- **Load balancers** for log ingestion endpoints
- **External storage** for long-term retention

### Best Practices
- **Use SSD storage** for Elasticsearch
- **Configure memory limits** appropriately
- **Monitor disk usage** continuously
- **Set up backup strategies** for critical logs
- **Implement log forwarding** to SIEM systems

This comprehensive logging system ensures full observability and traceability for the MCP Manus Server in production environments.