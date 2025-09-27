# Docker Secrets Management

This directory contains templates and configurations for managing secrets in Docker deployments.

## Overview

The MCP Manus Server uses Docker secrets for secure credential management in production environments. This approach provides better security than environment variables by:

- Storing secrets in encrypted form
- Limiting access to containers that need them
- Avoiding exposure in process lists or container inspect
- Enabling secret rotation without container rebuilds

## Secret Files

### Required Secrets

1. **jwt_secret** - JWT signing key (minimum 32 characters)
2. **oauth_client_secret** - OAuth 2.1 client secret (minimum 32 characters)

### Optional Secrets

3. **manus_api_key** - Manus.im API key (when available)
4. **database_password** - Database connection password
5. **redis_password** - Redis authentication password
6. **sentry_dsn** - Sentry error reporting DSN

## Usage

### Development

For development, secrets can be provided via environment variables:

```bash
export JWT_SECRET="your-32-character-jwt-secret-here"
export OAUTH_CLIENT_SECRET="your-oauth-client-secret-here"
```

### Docker Compose

Create secret files and use Docker Compose secrets:

```bash
# Create secret files
echo "your-jwt-secret" | docker secret create jwt_secret -
echo "your-oauth-secret" | docker secret create oauth_client_secret -

# Or from files
docker secret create jwt_secret ./secrets/jwt_secret.txt
```

### Kubernetes

Use Kubernetes secrets:

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: mcp-manus-secrets
type: Opaque
data:
  jwt_secret: <base64-encoded-value>
  oauth_client_secret: <base64-encoded-value>
```

## Secret Generation

Generate secure secrets using the built-in utility:

```typescript
import { secretsManager } from './src/utils/secrets.js';

// Generate a 32-character secure secret
const secret = secretsManager.generateSecureSecret(32);
console.log(secret);
```

Or use OpenSSL:

```bash
# Generate 32-byte secret and encode as base64
openssl rand -base64 32

# Generate 256-bit secret as hex
openssl rand -hex 32
```

## Security Best Practices

1. **Never commit secrets to version control**
2. **Use different secrets for each environment**
3. **Rotate secrets regularly**
4. **Use minimum required permissions**
5. **Monitor secret access logs**

## File Structure

```
docker/secrets/
├── README.md                 # This file
├── jwt_secret.example        # JWT secret template
├── oauth_client_secret.example  # OAuth secret template
├── compose-secrets.yml       # Docker Compose with secrets
└── k8s-secrets.yaml         # Kubernetes secrets manifest
```

## Validation

The application validates secrets on startup:

- Minimum length requirements
- Pattern validation (no weak patterns)
- Entropy checks
- Format validation (e.g., URLs for DSNs)

## Troubleshooting

### Secret Not Found

```
Error: Required secret 'jwt_secret' not found
```

**Solution**: Ensure the secret file exists at `/run/secrets/jwt_secret` or set the `JWT_SECRET` environment variable.

### Permission Denied

```
Error: Failed to read secret from /run/secrets/jwt_secret
```

**Solution**: Check file permissions and Docker secret mounting configuration.

### Validation Failed

```
Error: Secret 'jwt_secret' is too short (minimum 32 characters)
```

**Solution**: Generate a longer secret meeting the minimum requirements.

## Monitoring

Monitor secret health through the application metrics:

- Secret load status
- Validation results
- Last rotation timestamp
- Access frequency

## Rotation

Rotate secrets without downtime:

1. Update secret in secret store
2. Rolling restart of application pods
3. Verify new secret is loaded
4. Remove old secret

Example rotation script:

```bash
#!/bin/bash
# Rotate JWT secret
NEW_SECRET=$(openssl rand -base64 32)
echo "$NEW_SECRET" | docker secret create jwt_secret_new -
docker service update --secret-rm jwt_secret --secret-add jwt_secret_new mcp-manus-server
docker secret rm jwt_secret
docker secret create jwt_secret - <<< "$NEW_SECRET"
docker secret rm jwt_secret_new
```