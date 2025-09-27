# MCP Manus Server Monitoring

This directory contains the complete monitoring stack for the MCP Manus Server, implementing 2025 best practices for observability.

## Overview

The monitoring solution includes:
- **Prometheus** - Metrics collection and storage
- **Grafana** - Metrics visualization and dashboards
- **AlertManager** - Alert management and notification routing
- **Node Exporter** - System-level metrics
- **cAdvisor** - Container metrics
- **Blackbox Exporter** - Endpoint monitoring

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   MCP Server    │───▶│   Prometheus    │───▶│     Grafana     │
│   (Port 3000)   │    │   (Port 9090)   │    │   (Port 3001)   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  Health Checks  │    │  AlertManager   │    │   Dashboards    │
│  /health /ready │    │   (Port 9093)   │    │   Monitoring    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## Quick Start

1. **Start the monitoring stack:**
   ```bash
   cd monitoring
   docker-compose up -d
   ```

2. **Access the interfaces:**
   - Grafana: http://localhost:3001 (admin/admin)
   - Prometheus: http://localhost:9090
   - AlertManager: http://localhost:9093

3. **View metrics:**
   - MCP Server metrics: http://localhost:3000/metrics
   - Health check: http://localhost:3000/health
   - Readiness check: http://localhost:3000/ready

## Metrics Categories

### HTTP Metrics
- Request rate and duration
- Status code distribution
- Response time percentiles
- Requests in flight

### MCP Protocol Metrics
- Active connections by protocol version
- Request rates by method and resource type
- Error rates and types
- Request duration histograms

### OAuth Metrics
- Authorization attempts and success rates
- Token exchange rates
- Error tracking by type

### Manus.im API Metrics
- API request rates and latency
- Error rates by endpoint
- Response time tracking

### System Metrics
- Memory and CPU usage
- Garbage collection pressure
- Event loop lag
- Process uptime

### Security Metrics
- Secret loading status
- Configuration validation
- Failed authentication attempts
- Security policy violations

## Alerts

### Critical Alerts
- Service down (> 1 minute)
- High error rate (> 10% for 2 minutes)
- Health check failures
- Secrets loading failures
- Configuration validation errors

### Warning Alerts
- High response time (> 1s 95th percentile)
- High memory usage (> 512MB)
- High CPU usage (> 80%)
- OAuth errors
- No active connections (> 15 minutes)

### Capacity Alerts
- High request volume (> 50 req/s)
- Event loop lag (> 100ms)
- GC pressure

## Dashboard Features

The Grafana dashboard includes:

1. **Overview Panel**
   - Request rate and response time
   - Active connections
   - Error rates

2. **Performance Panel**
   - Response time percentiles
   - Memory usage trends
   - CPU utilization

3. **Business Logic Panel**
   - MCP operation success rates
   - OAuth flow metrics
   - Manus.im API health

4. **System Health Panel**
   - Configuration status
   - Secrets status
   - Health checks

## Configuration

### Environment Variables

Required for production:
```bash
# Grafana
GRAFANA_PASSWORD=your-secure-password

# Prometheus
PROMETHEUS_PASSWORD=prometheus-auth-password

# Alerts
SLACK_WEBHOOK_URL=https://hooks.slack.com/...

# Email (optional)
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=alerts@example.com
SMTP_PASSWORD=your-email-password
```

### Alert Channels

Configure in `alertmanager/alertmanager.yml`:
- **Email**: For critical alerts
- **Slack**: For all alert levels
- **Webhook**: For custom integrations

### Custom Metrics

Add custom metrics to your application:

```typescript
import { metricsCollector } from '../monitoring/metrics.js';

// Record custom business metric
metricsCollector.recordMcpRequest('custom_operation', 'custom_resource', 'success', 0.5);

// Record external API call
metricsCollector.recordManusApiRequest('/api/endpoint', 'GET', 200, 0.2);
```

## Scaling

### Production Setup

1. **Use external Prometheus storage:**
   ```yaml
   remote_write:
     - url: "https://your-prometheus-remote-write-endpoint"
   ```

2. **Configure high availability:**
   - Multiple Prometheus replicas
   - External AlertManager cluster
   - Shared Grafana database

3. **Resource allocation:**
   - Prometheus: 4GB RAM, 2 CPU
   - Grafana: 1GB RAM, 1 CPU
   - AlertManager: 512MB RAM, 0.5 CPU

### Multi-Environment

Separate configurations for:
- **Development**: Full local stack
- **Staging**: Reduced retention, basic alerts
- **Production**: Full monitoring, comprehensive alerts

## Troubleshooting

### Common Issues

1. **Metrics not appearing:**
   - Check if `/metrics` endpoint is accessible
   - Verify Prometheus target configuration
   - Check network connectivity

2. **Alerts not firing:**
   - Verify AlertManager configuration
   - Check alert rule syntax
   - Test notification channels

3. **High memory usage:**
   - Reduce metric retention time
   - Optimize metric cardinality
   - Enable metric sampling

### Debug Commands

```bash
# Check Prometheus targets
curl http://localhost:9090/api/v1/targets

# Test AlertManager config
docker exec mcp-alertmanager amtool config check

# View metric samples
curl http://localhost:3000/metrics | grep mcp_server

# Check container health
docker-compose ps
docker-compose logs prometheus
```

## Security

### Best Practices

1. **Authentication:**
   - Enable Grafana authentication
   - Secure Prometheus with basic auth
   - Use TLS in production

2. **Network Security:**
   - Restrict port access
   - Use private networks
   - Configure firewalls

3. **Data Protection:**
   - Encrypt metrics storage
   - Secure backup procedures
   - Implement retention policies

### Sensitive Data

Never include in metrics:
- User passwords or tokens
- API keys or secrets
- Personal identifiable information
- Internal system details

## Maintenance

### Regular Tasks

1. **Weekly:**
   - Review alert noise
   - Check disk usage
   - Update retention policies

2. **Monthly:**
   - Update dashboard queries
   - Review metric cardinality
   - Optimize storage

3. **Quarterly:**
   - Update monitoring stack
   - Review alert thresholds
   - Conduct monitoring drills

### Backup

Critical components to backup:
- Grafana dashboards and data sources
- Prometheus configuration
- AlertManager configuration
- Custom alert rules

## Integration

### CI/CD Integration

The monitoring stack integrates with:
- GitHub Actions for deployment
- Docker for containerization
- Kubernetes for orchestration
- External log aggregation

### External Services

Supported integrations:
- Slack for notifications
- Email for critical alerts
- Webhook for custom systems
- External metrics storage