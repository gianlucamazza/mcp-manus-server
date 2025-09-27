# MCP Manus Server - Performance Testing

This directory contains comprehensive performance testing infrastructure for the MCP Manus Server, implementing 2025 best practices for load testing, performance validation, and SLA monitoring.

## 🎯 Overview

The performance testing suite includes:
- **Load Testing**: k6 and Artillery.js configurations
- **Performance Baselines**: SLA definitions and thresholds
- **Stress Testing**: Peak load and breaking point analysis
- **Monitoring Integration**: Real-time performance tracking
- **CI/CD Integration**: Automated performance regression testing

## 🏗️ Testing Architecture

```text
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Load Tests    │───▶│   MCP Server    │───▶│   Monitoring    │
│  (k6/Artillery) │    │   (Target)      │    │  (Prometheus)   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  Test Results   │    │   Metrics       │    │   Dashboards    │
│  (Reports)      │    │  (Real-time)    │    │   (Grafana)     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 🚀 Quick Start

### Prerequisites

```bash
# Install k6
brew install k6
# or
npm install -g k6

# Install Artillery
npm install -g artillery
```

### Running Tests

#### k6 Load Test
```bash
# Basic load test
k6 run tests/performance/load-test.js

# With custom parameters
k6 run -e BASE_URL=https://staging-mcp-manus.example.com \
       -e OAUTH_CLIENT_ID=staging-client \
       tests/performance/load-test.js

# With custom stages
k6 run --stage 5m:100,10m:200,5m:0 tests/performance/load-test.js
```

#### Artillery Load Test
```bash
# Run Artillery test
artillery run tests/performance/artillery-config.yml

# Quick test
artillery quick --count 10 --num 100 http://localhost:3000/health

# With custom target
artillery run -t https://mcp-manus.example.com tests/performance/artillery-config.yml
```

## 📊 Performance Baselines & SLOs

### Service Level Objectives (SLOs)

| Metric | Target | Measurement |
|--------|--------|-------------|
| **Availability** | 99.9% | HTTP 2xx responses |
| **Response Time** | p95 < 500ms | HTTP request duration |
| **Error Rate** | < 1% | HTTP 5xx responses |
| **Throughput** | > 100 req/s | Sustained load capacity |

### Performance Thresholds

#### k6 Thresholds
```javascript
thresholds: {
  http_req_duration: ['p(95)<500'],     // 95% under 500ms
  http_req_failed: ['rate<0.01'],       // Error rate under 1%
  http_reqs: ['rate>100'],              // Min 100 req/s
  response_time: ['p(99)<1000']         // 99% under 1000ms
}
```

#### Artillery Thresholds
```yaml
ensure:
  p95: 500        # 95th percentile under 500ms
  p99: 1000       # 99th percentile under 1000ms
  maxErrorRate: 1 # Error rate under 1%
```

## 🎭 Test Scenarios

### 1. Health Check Load (40% traffic)
- **Endpoint**: `GET /health`
- **Expected**: 200 status, < 100ms response
- **Purpose**: Kubernetes liveness probe simulation

### 2. Readiness Check Load (20% traffic)
- **Endpoint**: `GET /ready`
- **Expected**: 200 status, availability validation
- **Purpose**: Kubernetes readiness probe simulation

### 3. OAuth Discovery Load (15% traffic)
- **Endpoint**: `GET /.well-known/oauth-authorization-server`
- **Expected**: 200 status, valid OAuth metadata
- **Purpose**: Client discovery simulation

### 4. Metrics Collection Load (10% traffic)
- **Endpoint**: `GET /metrics`
- **Expected**: 200 status, Prometheus format
- **Purpose**: Monitoring system simulation

### 5. API Information Load (10% traffic)
- **Endpoint**: `GET /`
- **Expected**: 200 status, server metadata
- **Purpose**: API exploration simulation

### 6. Security Status Load (5% traffic)
- **Endpoint**: `GET /api/security/status`
- **Expected**: 200 status, security components
- **Purpose**: Security monitoring simulation

## 📈 Load Testing Patterns

### 1. Constant Load Testing
```bash
# Sustained load for capacity planning
k6 run --vus 50 --duration 10m tests/performance/load-test.js
```

### 2. Spike Testing
```bash
# Sudden traffic spike simulation
k6 run --stage 1m:10,30s:100,1m:10 tests/performance/load-test.js
```

### 3. Stress Testing
```bash
# Breaking point identification
k6 run --stage 2m:50,5m:100,2m:150,5m:200,2m:0 tests/performance/load-test.js
```

### 4. Soak Testing
```bash
# Long-duration stability testing
k6 run --vus 30 --duration 30m tests/performance/load-test.js
```

### 5. Volume Testing
```bash
# High-volume data processing
artillery run --overrides '{"config":{"phases":[{"duration":600,"arrivalRate":100}]}}' \
  tests/performance/artillery-config.yml
```

## 🔍 Performance Monitoring

### Real-time Monitoring

During tests, monitor:
```bash
# Server metrics
curl http://localhost:3000/metrics | grep mcp_server

# System resources
docker stats mcp-manus-server

# Kubernetes pods (if deployed)
kubectl top pods -n mcp-manus
```

### Grafana Dashboards

**Performance Dashboard Panels**:
- Request rate and response time trends
- Error rate and availability metrics
- Resource utilization (CPU, memory)
- Concurrent connections and queue depths

**SLO Dashboard**:
- Availability SLO tracking
- Response time SLO monitoring
- Error budget burn rate
- Performance regression detection

## 📊 Test Results Analysis

### k6 Results
```bash
# Generate detailed report
k6 run --out json=results.json tests/performance/load-test.js

# View summary
k6 run --summary-trend-stats="avg,min,med,max,p(95),p(99)" tests/performance/load-test.js
```

### Artillery Results
```bash
# Run with detailed reporting
artillery run tests/performance/artillery-config.yml --output report.json

# Generate HTML report
artillery report report.json --output report.html
```

### Performance Regression Detection

```bash
# Compare with baseline
k6 run --out json=current.json tests/performance/load-test.js
node scripts/compare-performance.js baseline.json current.json
```

## 🚨 Performance Alerts

### Prometheus Alerts

```yaml
# Response time degradation
- alert: PerformanceDegradation
  expr: histogram_quantile(0.95, rate(mcp_server_http_request_duration_seconds_bucket[5m])) > 0.5
  for: 5m
  labels:
    severity: warning
  annotations:
    summary: "Response time degradation detected"

# Throughput drop
- alert: ThroughputDrop
  expr: rate(mcp_server_http_requests_total[5m]) < 50
  for: 10m
  labels:
    severity: warning
  annotations:
    summary: "Request throughput below baseline"
```

### CI/CD Integration

```yaml
# GitHub Actions performance gate
- name: Performance Testing
  run: |
    npm start &
    sleep 10
    k6 run tests/performance/load-test.js
    kill %1
```

## 🔧 Configuration

### Environment Variables

```bash
# Test configuration
export BASE_URL="https://mcp-manus.example.com"
export OAUTH_CLIENT_ID="performance-test-client"
export TEST_DURATION="10m"
export MAX_VUS="200"

# Run tests
k6 run tests/performance/load-test.js
```

### Custom Test Scenarios

Create custom scenario files:

```javascript
// tests/performance/custom-scenario.js
export const options = {
  scenarios: {
    custom_load: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        // Your custom stages
      ]
    }
  }
};
```

## 🛠️ Troubleshooting

### Common Issues

#### Server Not Responding
```bash
# Check server status
curl -f http://localhost:3000/health

# Check Docker container
docker ps | grep mcp-manus
docker logs mcp-manus-server
```

#### High Error Rates
```bash
# Check server logs during test
tail -f logs/error.log

# Monitor system resources
top -p $(pgrep -f "node.*mcp-manus")
```

#### Performance Degradation
```bash
# Profile application
node --prof src/index.js
node --prof-process isolate-*.log > profile.txt

# Memory leak detection
node --inspect src/index.js
```

### Performance Optimization

#### Code Optimization
- **Async operations**: Proper async/await usage
- **Memory management**: Avoid memory leaks
- **CPU optimization**: Efficient algorithms
- **I/O optimization**: Connection pooling

#### Infrastructure Optimization
- **Container resources**: Appropriate CPU/memory limits
- **Kubernetes**: HPA configuration tuning
- **Network**: Connection keep-alive optimization
- **Storage**: Efficient log handling

## 📈 Continuous Performance Testing

### Automated Testing
- **Nightly performance tests**: Regression detection
- **Release validation**: Performance gate in CI/CD
- **Load testing schedule**: Weekly stress tests
- **Performance trending**: Long-term analysis

### Performance Culture
- **Performance budgets**: Resource allocation limits
- **Performance reviews**: Regular performance analysis
- **Team training**: Performance testing best practices
- **Monitoring integration**: Production performance tracking

This comprehensive performance testing framework ensures the MCP Manus Server maintains optimal performance under various load conditions and scales effectively for enterprise deployment.