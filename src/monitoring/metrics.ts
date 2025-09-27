import { register, collectDefaultMetrics, Counter, Histogram, Gauge } from 'prom-client';
import { logger } from '../utils/logger.js';

export class MetricsCollector {
  private static instance: MetricsCollector;
  
  // HTTP metrics
  public readonly httpRequestsTotal: Counter<string>;
  public readonly httpRequestDuration: Histogram<string>;
  public readonly httpRequestsInFlight: Gauge<string>;
  
  // MCP specific metrics
  public readonly mcpConnectionsTotal: Gauge<string>;
  public readonly mcpRequestsTotal: Counter<string>;
  public readonly mcpRequestDuration: Histogram<string>;
  public readonly mcpErrorsTotal: Counter<string>;
  
  // OAuth metrics
  public readonly oauthAuthorizationsTotal: Counter<string>;
  public readonly oauthTokenExchanges: Counter<string>;
  public readonly oauthErrorsTotal: Counter<string>;
  
  // Manus.im API metrics
  public readonly manusApiRequestsTotal: Counter<string>;
  public readonly manusApiRequestDuration: Histogram<string>;
  public readonly manusApiErrorsTotal: Counter<string>;
  
  // System metrics
  public readonly secretsLoadStatus: Gauge<string>;
  public readonly configValidationStatus: Gauge<string>;
  public readonly healthCheckStatus: Gauge<string>;

  private constructor() {
    // Enable default Node.js metrics collection
    collectDefaultMetrics({
      register,
      prefix: 'mcp_server_',
      gcDurationBuckets: [0.001, 0.01, 0.1, 1, 2, 5],
      eventLoopMonitoringPrecision: 5
    });

    // HTTP Request metrics
    this.httpRequestsTotal = new Counter({
      name: 'mcp_server_http_requests_total',
      help: 'Total number of HTTP requests',
      labelNames: ['method', 'route', 'status_code', 'status_class'],
      registers: [register]
    });

    this.httpRequestDuration = new Histogram({
      name: 'mcp_server_http_request_duration_seconds',
      help: 'HTTP request duration in seconds',
      labelNames: ['method', 'route', 'status_code'],
      buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
      registers: [register]
    });

    this.httpRequestsInFlight = new Gauge({
      name: 'mcp_server_http_requests_in_flight',
      help: 'Current number of HTTP requests being processed',
      labelNames: ['method', 'route'],
      registers: [register]
    });

    // MCP Protocol metrics
    this.mcpConnectionsTotal = new Gauge({
      name: 'mcp_server_connections_current',
      help: 'Current number of active MCP connections',
      labelNames: ['protocol_version', 'client_type'],
      registers: [register]
    });

    this.mcpRequestsTotal = new Counter({
      name: 'mcp_server_mcp_requests_total',
      help: 'Total number of MCP requests',
      labelNames: ['method', 'resource_type', 'status'],
      registers: [register]
    });

    this.mcpRequestDuration = new Histogram({
      name: 'mcp_server_mcp_request_duration_seconds',
      help: 'MCP request duration in seconds',
      labelNames: ['method', 'resource_type'],
      buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2],
      registers: [register]
    });

    this.mcpErrorsTotal = new Counter({
      name: 'mcp_server_mcp_errors_total',
      help: 'Total number of MCP errors',
      labelNames: ['error_type', 'error_code', 'method'],
      registers: [register]
    });

    // OAuth metrics
    this.oauthAuthorizationsTotal = new Counter({
      name: 'mcp_server_oauth_authorizations_total',
      help: 'Total number of OAuth authorization attempts',
      labelNames: ['client_id', 'response_type', 'status'],
      registers: [register]
    });

    this.oauthTokenExchanges = new Counter({
      name: 'mcp_server_oauth_token_exchanges_total',
      help: 'Total number of OAuth token exchanges',
      labelNames: ['grant_type', 'status'],
      registers: [register]
    });

    this.oauthErrorsTotal = new Counter({
      name: 'mcp_server_oauth_errors_total',
      help: 'Total number of OAuth errors',
      labelNames: ['error_type', 'grant_type'],
      registers: [register]
    });

    // Manus.im API metrics
    this.manusApiRequestsTotal = new Counter({
      name: 'mcp_server_manus_api_requests_total',
      help: 'Total number of requests to Manus.im API',
      labelNames: ['endpoint', 'method', 'status_code'],
      registers: [register]
    });

    this.manusApiRequestDuration = new Histogram({
      name: 'mcp_server_manus_api_request_duration_seconds',
      help: 'Manus.im API request duration in seconds',
      labelNames: ['endpoint', 'method'],
      buckets: [0.1, 0.25, 0.5, 1, 2, 5, 10, 30],
      registers: [register]
    });

    this.manusApiErrorsTotal = new Counter({
      name: 'mcp_server_manus_api_errors_total',
      help: 'Total number of Manus.im API errors',
      labelNames: ['endpoint', 'error_type', 'status_code'],
      registers: [register]
    });

    // System health metrics
    this.secretsLoadStatus = new Gauge({
      name: 'mcp_server_secrets_load_status',
      help: 'Status of secrets loading (1 = success, 0 = failure)',
      labelNames: ['secret_name', 'source'],
      registers: [register]
    });

    this.configValidationStatus = new Gauge({
      name: 'mcp_server_config_validation_status',
      help: 'Status of configuration validation (1 = valid, 0 = invalid)',
      labelNames: ['environment'],
      registers: [register]
    });

    this.healthCheckStatus = new Gauge({
      name: 'mcp_server_health_check_status',
      help: 'Health check status (1 = healthy, 0 = unhealthy)',
      labelNames: ['check_name', 'component'],
      registers: [register]
    });

    logger.info('Prometheus metrics collector initialized');
  }

  public static getInstance(): MetricsCollector {
    if (!MetricsCollector.instance) {
      MetricsCollector.instance = new MetricsCollector();
    }
    return MetricsCollector.instance;
  }

  public getRegistry() {
    return register;
  }

  public async getMetrics(): Promise<string> {
    return register.metrics();
  }

  public recordHttpRequest(
    method: string,
    route: string,
    statusCode: number,
    duration: number
  ): void {
    const statusClass = `${Math.floor(statusCode / 100)}xx`;
    
    this.httpRequestsTotal.inc({
      method,
      route,
      status_code: statusCode.toString(),
      status_class: statusClass
    });

    this.httpRequestDuration.observe(
      { method, route, status_code: statusCode.toString() },
      duration
    );
  }

  public recordHttpRequestStart(method: string, route: string): void {
    this.httpRequestsInFlight.inc({ method, route });
  }

  public recordHttpRequestEnd(method: string, route: string): void {
    this.httpRequestsInFlight.dec({ method, route });
  }

  public recordMcpConnection(protocolVersion: string, clientType: string, delta: number = 1): void {
    this.mcpConnectionsTotal.inc({ protocol_version: protocolVersion, client_type: clientType }, delta);
  }

  public recordMcpRequest(
    method: string,
    resourceType: string,
    status: string,
    duration?: number
  ): void {
    this.mcpRequestsTotal.inc({ method, resource_type: resourceType, status });
    
    if (duration !== undefined) {
      this.mcpRequestDuration.observe({ method, resource_type: resourceType }, duration);
    }
  }

  public recordMcpError(errorType: string, errorCode: string, method: string): void {
    this.mcpErrorsTotal.inc({ error_type: errorType, error_code: errorCode, method });
  }

  public recordOAuthAuthorization(clientId: string, responseType: string, status: string): void {
    this.oauthAuthorizationsTotal.inc({ client_id: clientId, response_type: responseType, status });
  }

  public recordOAuthTokenExchange(grantType: string, status: string): void {
    this.oauthTokenExchanges.inc({ grant_type: grantType, status });
  }

  public recordOAuthError(errorType: string, grantType: string): void {
    this.oauthErrorsTotal.inc({ error_type: errorType, grant_type: grantType });
  }

  public recordManusApiRequest(
    endpoint: string,
    method: string,
    statusCode: number,
    duration: number
  ): void {
    this.manusApiRequestsTotal.inc({
      endpoint,
      method,
      status_code: statusCode.toString()
    });

    this.manusApiRequestDuration.observe({ endpoint, method }, duration);
  }

  public recordManusApiError(endpoint: string, errorType: string, statusCode: number): void {
    this.manusApiErrorsTotal.inc({
      endpoint,
      error_type: errorType,
      status_code: statusCode.toString()
    });
  }

  public updateSecretsStatus(secretName: string, source: string, status: boolean): void {
    this.secretsLoadStatus.set({ secret_name: secretName, source }, status ? 1 : 0);
  }

  public updateConfigValidationStatus(environment: string, isValid: boolean): void {
    this.configValidationStatus.set({ environment }, isValid ? 1 : 0);
  }

  public updateHealthCheckStatus(checkName: string, component: string, isHealthy: boolean): void {
    this.healthCheckStatus.set({ check_name: checkName, component }, isHealthy ? 1 : 0);
  }

  public reset(): void {
    register.resetMetrics();
    logger.info('Prometheus metrics reset');
  }

  public async collectMetrics(): Promise<Record<string, any>> {
    const metrics = await register.getMetricsAsJSON();
    
    return {
      timestamp: new Date().toISOString(),
      metrics: metrics.reduce((acc, metric) => {
        acc[metric.name] = {
          help: metric.help,
          type: metric.type,
          values: metric.values
        };
        return acc;
      }, {} as Record<string, any>)
    };
  }
}

// Export singleton instance
export const metricsCollector = MetricsCollector.getInstance();