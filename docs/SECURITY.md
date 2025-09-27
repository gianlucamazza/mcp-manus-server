# Security Guidelines - MCP Manus Server

## Overview

This document outlines the security architecture, best practices, and guidelines implemented in the MCP Manus Server following 2025 industry standards and Model Context Protocol security recommendations.

## Security Architecture

### Multi-Layer Security Model

1. **Container Isolation Layer**
   - Docker containerization with non-root user execution
   - Read-only root filesystem with specific writable volumes
   - Resource limits and capability restrictions
   - Security-hardened Alpine Linux base image

2. **Network Security Layer**
   - Nginx reverse proxy with rate limiting
   - Security headers (HSTS, CSP, X-Frame-Options)
   - Network isolation with custom bridge networks
   - Port exposure limited to necessary services only

3. **Application Security Layer**
   - OAuth 2.1 authentication with PKCE
   - JWT token validation with resource indicators
   - Input validation using Zod schemas
   - Comprehensive audit logging

4. **Data Protection Layer**
   - Environment variable isolation
   - Secret management through Docker secrets
   - Encrypted communication (HTTPS/TLS)
   - No hardcoded credentials or sensitive data

## Authentication & Authorization

### OAuth 2.1 Implementation

The server implements OAuth 2.1 following the latest specification (2025-06-18) with these security features:

```typescript
// Resource Indicators for token protection
const tokenRequest = {
  client_id: config.clientId,
  resource: 'https://api.manus.im/v1/',
  scope: 'read write'
};
```

**Key Security Features:**
- State parameter validation with JWT-signed tokens
- PKCE (Proof Key for Code Exchange) support
- Token expiration and refresh mechanisms
- Resource-specific token scoping

### Access Control

**Tool Access Control:**
- Whitelist-based tool access permissions
- Rate limiting per user/IP (100 requests/minute for tools)
- Path validation for file system access
- Restricted tool blacklisting (`system_admin`, `file_delete`, `network_scan`)

**Resource Access Control:**
- URI-based access validation
- Pattern matching for restricted resources
- Rate limiting for resource access (50 requests/minute)
- Audit logging for all access attempts

## Input Validation & Sanitization

### Schema Validation

All inputs are validated using Zod schemas:

```typescript
const ManusTaskSchema = z.object({
  type: z.enum(['text', 'image', 'code', 'file', 'web']),
  input: z.any(),
  options: z.record(z.unknown()).optional()
});
```

### Security Validations

1. **File Path Validation:**
   ```typescript
   const restrictedPaths = [
     '/etc/passwd', '/etc/shadow', '/proc/', '/sys/',
     '~/.ssh/', '~/.aws/', '~/.gcp/'
   ];
   ```

2. **URI Validation:**
   ```typescript
   const restrictedUris = [
     'file:///etc/passwd', 'file:///etc/shadow', 'mcp://admin/*'
   ];
   ```

## Rate Limiting & DoS Protection

### Application Level Rate Limiting

- **Tool Access:** 100 requests per minute per user
- **Resource Access:** 50 requests per minute per user
- **Authentication:** 1 request per second per IP

### Nginx Level Protection

```nginx
limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
limit_req_zone $binary_remote_addr zone=auth:10m rate=1r/s;
```

## Audit Logging & Monitoring

### Security Event Logging

All security-relevant events are logged with structured data:

```typescript
logSecurityEvent('tool_call_failed', {
  toolName: 'restricted_tool',
  userId: 'user123',
  timestamp: new Date().toISOString(),
  severity: 'high'
});
```

### Monitored Events

- Failed authentication attempts
- Rate limit violations
- Restricted resource access attempts
- Tool execution failures
- OAuth flow anomalies

## Container Security

### Dockerfile Security Hardening

```dockerfile
# Non-root user execution
RUN addgroup -g 1001 -S nodejs && \
    adduser -S mcpuser -u 1001 -G nodejs
USER mcpuser

# Security labels
LABEL security.scan="enabled"

# Health checks for monitoring
HEALTHCHECK --interval=30s --timeout=10s CMD /healthcheck.sh
```

### Docker Compose Security

```yaml
security_opt:
  - no-new-privileges:true
cap_drop:
  - ALL
cap_add:
  - SETUID
  - SETGID
read_only: true
```

## Environment Configuration

### Required Environment Variables

```bash
# OAuth 2.1 Configuration
OAUTH_CLIENT_ID=your_client_id
OAUTH_CLIENT_SECRET=your_client_secret
OAUTH_REDIRECT_URI=https://your-domain.com/oauth/callback

# JWT Security
JWT_SECRET=your-very-secure-random-string-256-bits

# Manus.im API
MANUS_API_KEY=your_manus_api_key
```

### Security Best Practices

1. **Never commit secrets to version control**
2. **Use Docker secrets for production deployments**
3. **Rotate API keys and secrets regularly**
4. **Use environment-specific configurations**

## Vulnerability Management

### Security Scanning

1. **Container Scanning:**
   ```bash
   docker scan mcp-manus-server:latest
   ```

2. **Dependency Scanning:**
   ```bash
   npm audit
   npm audit fix
   ```

3. **SAST Analysis:**
   ```bash
   npm run lint
   npm run typecheck
   ```

### Update Strategy

- **Base Image Updates:** Monthly security updates
- **Dependency Updates:** Weekly automated dependency updates
- **Security Patches:** Immediate application for critical vulnerabilities

## Incident Response

### Security Incident Classification

1. **Critical:** Unauthorized access, data breach, service compromise
2. **High:** Authentication bypass, privilege escalation
3. **Medium:** Rate limit bypass, input validation failures
4. **Low:** Information disclosure, availability issues

### Response Procedures

1. **Immediate Actions:**
   - Isolate affected systems
   - Preserve logs and evidence
   - Notify security team

2. **Investigation:**
   - Analyze security logs
   - Identify attack vectors
   - Assess impact and scope

3. **Recovery:**
   - Apply security patches
   - Update security configurations
   - Restore normal operations

## Compliance & Standards

### MCP Security Best Practices

Following Model Context Protocol security guidelines:

- ✅ Explicit user consent for tool invocations
- ✅ Treat tool descriptions as potentially untrusted
- ✅ Clear understanding of tool behaviors before authorization
- ✅ Robust consent and authorization flows
- ✅ Appropriate access controls and data protections

### Industry Standards Compliance

- **OWASP Top 10 2025:** Addressed all common vulnerabilities
- **NIST Cybersecurity Framework:** Implemented Identify, Protect, Detect, Respond, Recover
- **SOC 2 Type II:** Security controls aligned with SOC 2 requirements

## Security Testing

### Automated Security Tests

```bash
# Run security test suite
npm run test:security

# Container security scan
npm run docker:security-scan

# OWASP dependency check
npm run security:deps
```

### Manual Security Reviews

1. **Code Review Checklist:**
   - Input validation and sanitization
   - Authentication and authorization
   - Error handling and information disclosure
   - Logging and monitoring coverage

2. **Penetration Testing:**
   - Authentication bypass attempts
   - Authorization circumvention
   - Input validation testing
   - Rate limiting verification

## Maintenance & Updates

### Security Maintenance Schedule

- **Daily:** Monitor security logs and alerts
- **Weekly:** Review and update dependencies
- **Monthly:** Security configuration review
- **Quarterly:** Penetration testing and security audit

### Contact Information

For security issues or questions:
- **Security Team:** security@yourorganization.com
- **Emergency Response:** +1-XXX-XXX-XXXX
- **Bug Bounty Program:** https://your-domain.com/security/responsible-disclosure

---

*This document is reviewed quarterly and updated as needed to reflect current security best practices and threat landscape changes.*