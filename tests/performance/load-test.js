// MCP Manus Server - Performance Testing with k6
// Following 2025 best practices for load testing and performance validation

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const responseTime = new Trend('response_time');
const requestsCount = new Counter('requests_total');

// Test configuration
export const options = {
  stages: [
    // Ramp-up phase
    { duration: '2m', target: 10 }, // Ramp up to 10 users
    { duration: '3m', target: 50 }, // Ramp up to 50 users
    { duration: '10m', target: 100 }, // Stay at 100 users for 10 minutes
    { duration: '2m', target: 200 }, // Ramp up to 200 users
    { duration: '5m', target: 200 }, // Stay at 200 users
    { duration: '2m', target: 0 }, // Ramp down to 0 users
  ],
  thresholds: {
    // Performance SLOs
    http_req_duration: ['p(95)<500'], // 95% of requests under 500ms
    http_req_failed: ['rate<0.01'], // Error rate under 1%
    http_reqs: ['rate>100'], // At least 100 req/s during peak
    
    // Custom metrics thresholds
    errors: ['rate<0.01'],
    response_time: ['p(95)<500', 'p(99)<1000'],
    requests_total: ['count>10000']
  },
  // Test environment configuration
  ext: {
    loadimpact: {
      distribution: {
        'amazon:us:ashburn': { loadZone: 'amazon:us:ashburn', percent: 50 },
        'amazon:ie:dublin': { loadZone: 'amazon:ie:dublin', percent: 50 }
      }
    }
  }
};

// Test configuration based on environment
const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const OAUTH_CLIENT_ID = __ENV.OAUTH_CLIENT_ID || 'test-client-id';
const TEST_JWT_TOKEN = __ENV.TEST_JWT_TOKEN || 'test-token';

// Test data
const testPayloads = {
  healthCheck: {},
  mcpToolCall: {
    name: 'get_system_info',
    arguments: {}
  },
  mcpResourceRead: {
    uri: 'mcp://system/status'
  },
  oauthAuthorize: {
    client_id: OAUTH_CLIENT_ID,
    response_type: 'code',
    redirect_uri: `${BASE_URL}/oauth/callback`,
    scope: 'read write',
    state: 'test-state',
    code_challenge: 'test-challenge',
    code_challenge_method: 'S256'
  }
};

// Request headers
const headers = {
  'Content-Type': 'application/json',
  'User-Agent': 'k6-performance-test/1.0.0',
  'X-Correlation-ID': () => `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
};

export default function () {
  const correlationId = `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const requestHeaders = {
    ...headers,
    'X-Correlation-ID': correlationId,
    'X-Request-ID': `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  };

  // Test scenario 1: Health check endpoint (high frequency)
  if (Math.random() < 0.3) {
    const response = http.get(`${BASE_URL}/health`, { headers: requestHeaders });
    
    check(response, {
      'health check status is 200': (r) => r.status === 200,
      'health check response time < 100ms': (r) => r.timings.duration < 100,
      'health check has correlation ID': (r) => r.headers['X-Correlation-Id'] !== undefined
    });

    errorRate.add(response.status !== 200);
    responseTime.add(response.timings.duration);
    requestsCount.add(1);
  }

  // Test scenario 2: Metrics endpoint (monitoring load)
  if (Math.random() < 0.1) {
    const response = http.get(`${BASE_URL}/metrics`, { headers: requestHeaders });
    
    check(response, {
      'metrics status is 200': (r) => r.status === 200,
      'metrics response time < 200ms': (r) => r.timings.duration < 200,
      'metrics content type is correct': (r) => 
        r.headers['Content-Type'] && r.headers['Content-Type'].includes('text/plain')
    });

    errorRate.add(response.status !== 200);
    responseTime.add(response.timings.duration);
    requestsCount.add(1);
  }

  // Test scenario 3: OAuth discovery endpoints
  if (Math.random() < 0.2) {
    const response = http.get(
      `${BASE_URL}/.well-known/oauth-authorization-server`, 
      { headers: requestHeaders }
    );
    
    check(response, {
      'oauth discovery status is 200': (r) => r.status === 200,
      'oauth discovery response time < 150ms': (r) => r.timings.duration < 150,
      'oauth discovery has required fields': (r) => {
        try {
          const body = JSON.parse(r.body);
          return body.authorization_endpoint && body.token_endpoint;
        } catch {
          return false;
        }
      }
    });

    errorRate.add(response.status !== 200);
    responseTime.add(response.timings.duration);
    requestsCount.add(1);
  }

  // Test scenario 4: Security status endpoint
  if (Math.random() < 0.15) {
    const response = http.get(`${BASE_URL}/api/security/status`, { headers: requestHeaders });
    
    check(response, {
      'security status is 200': (r) => r.status === 200,
      'security status response time < 100ms': (r) => r.timings.duration < 100,
      'security status has components': (r) => {
        try {
          const body = JSON.parse(r.body);
          return body.components && typeof body.components === 'object';
        } catch {
          return false;
        }
      }
    });

    errorRate.add(response.status !== 200);
    responseTime.add(response.timings.duration);
    requestsCount.add(1);
  }

  // Test scenario 5: Root endpoint (API information)
  if (Math.random() < 0.25) {
    const response = http.get(`${BASE_URL}/`, { headers: requestHeaders });
    
    check(response, {
      'root endpoint status is 200': (r) => r.status === 200,
      'root endpoint response time < 50ms': (r) => r.timings.duration < 50,
      'root endpoint has server info': (r) => {
        try {
          const body = JSON.parse(r.body);
          return body.name && body.version && body.capabilities;
        } catch {
          return false;
        }
      }
    });

    errorRate.add(response.status !== 200);
    responseTime.add(response.timings.duration);
    requestsCount.add(1);
  }

  // Random sleep between 1-3 seconds to simulate realistic user behavior
  sleep(Math.random() * 2 + 1);
}

// Setup function - runs once before the test
export function setup() {
  console.log('🚀 Starting MCP Manus Server performance test');
  console.log(`📊 Target: ${BASE_URL}`);
  console.log(`⏱️  Duration: ~24 minutes`);
  console.log(`👥 Max VUs: 200`);
  
  // Warm up the server
  const warmupResponse = http.get(`${BASE_URL}/health`);
  if (warmupResponse.status !== 200) {
    console.error('❌ Server warmup failed - check if server is running');
    throw new Error('Server not available for testing');
  }
  
  console.log('✅ Server warmup successful');
  return { baseUrl: BASE_URL };
}

// Teardown function - runs once after the test
export function teardown(data) {
  console.log('🏁 Performance test completed');
  console.log(`📊 Base URL tested: ${data.baseUrl}`);
  
  // Final health check
  const finalResponse = http.get(`${BASE_URL}/health`);
  if (finalResponse.status === 200) {
    console.log('✅ Server is still healthy after performance test');
  } else {
    console.log('⚠️  Server health check failed after performance test');
  }
}

// Custom test scenarios for different load patterns
export const scenarios = {
  // Constant load scenario
  constant_load: {
    executor: 'constant-vus',
    vus: 50,
    duration: '5m',
    tags: { test_type: 'constant_load' }
  },
  
  // Spike testing scenario
  spike_test: {
    executor: 'ramping-vus',
    startVUs: 0,
    stages: [
      { duration: '1m', target: 10 },
      { duration: '30s', target: 100 }, // Spike
      { duration: '1m', target: 10 },
    ],
    tags: { test_type: 'spike' }
  },
  
  // Stress testing scenario
  stress_test: {
    executor: 'ramping-vus',
    startVUs: 0,
    stages: [
      { duration: '2m', target: 50 },
      { duration: '5m', target: 100 },
      { duration: '2m', target: 150 },
      { duration: '5m', target: 200 }, // Stress level
      { duration: '2m', target: 0 },
    ],
    tags: { test_type: 'stress' }
  },
  
  // Soak testing scenario (long duration, stable load)
  soak_test: {
    executor: 'constant-vus',
    vus: 30,
    duration: '30m',
    tags: { test_type: 'soak' }
  }
};

// Data-driven testing for different endpoints
export const endpoints = [
  { name: 'health', path: '/health', weight: 40 },
  { name: 'ready', path: '/ready', weight: 20 },
  { name: 'metrics', path: '/metrics', weight: 10 },
  { name: 'root', path: '/', weight: 15 },
  { name: 'oauth_discovery', path: '/.well-known/oauth-authorization-server', weight: 10 },
  { name: 'security_status', path: '/api/security/status', weight: 5 }
];