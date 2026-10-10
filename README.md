# MCP Manus Server

**Status: experimental. Tools currently return mock data; no live Manus.im API calls. Install (`npm ci` / `npm install`), lint, test, and build currently fail on `main`; this project is not deployable as-is.**

A Model Context Protocol (MCP) server with Manus.im integration scaffolding. Security, container, and observability files exist in the repo; they have not been verified by a working install or build.

## 🚀 Features

- **MCP protocol scaffolding**: Server code aims at the Model Context Protocol specification (2025-06-18); compliance is unverified because the project does not currently build
- **Manus.im Integration**: Placeholder MCP tools and an unused HTTP client; no live Manus.im API calls
- **OAuth 2.1 scaffolding**: PKCE and resource-indicator code is present; the auth flow currently returns mock tokens
- **Docker files**: Multi-stage Dockerfile and Compose files are present; images have not been verified on a working build
- **TypeScript**: Source is TypeScript targeting Node.js 20+; `npm run build` currently fails
- **Tests**: Unit, integration, and schema test files exist; `npm test` currently fails (Jest ESM config)
- **Observability files**: Logger, health-check, and Prometheus-related source exist; the stack is not verified as running

## 🏗️ Architecture

```text
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   MCP Client    │────│  Nginx Proxy    │────│  MCP Server     │
│   (Claude, etc) │    │  Rate Limiting  │    │  Authentication │
└─────────────────┘    │  Security Hdrs  │    │  Tool Manager   │
                       └─────────────────┘    │  Resource Mgr   │
                                             └─────────────────┘
                                                       │
                                             ┌─────────────────┐
                                             │   Manus.im API  │
                                             │   Integration   │
                                             └─────────────────┘
```

## 🛠️ Quick Start

These commands are the intended local workflow. On `main` they do not succeed: `npm install` fails on unpublished packages (`k6@^0.47.0`, `opentelemetry-auto@^0.32.0`), and there is no `package-lock.json` for `npm ci`.

### Prerequisites

- Node.js 20+
- Docker & Docker Compose
- Git

### Development Setup

1. **Clone and install dependencies (currently fails on `main`):**

   ```bash
   git clone <your-repo>
   cd mcp_manus
   npm install
   ```

2. **Configure environment:**

   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. **Start development server:**

   ```bash
   npm run dev
   ```

### Docker (unverified)

Compose files live under `docker/`. They have not been verified; the TypeScript build used by the image currently fails, so this is not a working one-command deploy.

1. **Intended Compose command:**

   ```bash
   docker-compose -f docker/docker-compose.yml up -d
   ```

2. **With HTTP proxy (optional):**

   ```bash
   docker-compose -f docker/docker-compose.yml --profile http up -d
   ```

3. **Health check:**

   ```bash
   curl http://localhost:8080/health
   ```

## 🔧 Configuration

### Environment Variables

| Variable              | Description                              | Required           |
| --------------------- | ---------------------------------------- | ------------------ |
| `OAUTH_CLIENT_ID`     | OAuth 2.1 client identifier              | ✅                  |
| `OAUTH_CLIENT_SECRET` | OAuth 2.1 client secret                  | ✅                  |
| `OAUTH_REDIRECT_URI`  | OAuth callback URL                       | ✅                  |
| `MANUS_API_KEY`       | Manus.im API key                         | 🔄 (when available) |
| `JWT_SECRET`          | JWT signing secret                       | ✅                  |
| `LOG_LEVEL`           | Logging level (debug, info, warn, error) | ❌                  |

### MCP Client Configuration

Add to your MCP client configuration:

```json
{
  "mcpServers": {
    "manus": {
      "command": "node",
      "args": ["path/to/mcp_manus/dist/index.js"],
      "env": {
        "OAUTH_CLIENT_ID": "your_client_id",
        "MANUS_API_KEY": "your_api_key"
      }
    }
  }
}
```

## 🔒 Security

Security-related code and docs are present. They have not been validated by a passing build, test suite, or deploy:

- **Container files**: Non-root user, read-only filesystem options, and capability restrictions appear in Docker/K8s files
- **Network-related code**: Rate limiting and security-header plugins are wired in source
- **Authentication code**: OAuth 2.1 with PKCE and JWT validation (demo/mock token paths remain)
- **Authorization code**: Tool/resource access controls and path validation
- **Input validation**: Zod schemas in tool handlers

See [docs/SECURITY.md](docs/SECURITY.md) for detailed security documentation.

## 🛡️ Available Tools

| Tool                  | Description            | Input Schema        |
| --------------------- | ---------------------- | ------------------- |
| `get_system_info`     | System information     | `{}`                |
| `echo`                | Echo input message     | `{message: string}` |
| `check_manus_credits` | Check Manus.im credits | `{}`                |

## 📊 Available Resources

| Resource              | Description                 | Content Type       |
| --------------------- | --------------------------- | ------------------ |
| `mcp://system/status` | System status and health    | `application/json` |
| `mcp://config/server` | Server configuration        | `application/json` |
| `mcp://manus/status`  | Manus.im integration status | `application/json` |

## 🧪 Testing

Test files exist under `tests/`. On `main`, `npm test` fails (Jest ESM / `moduleNameMapping` config), `npm run lint` fails (missing ESLint shareable config), and `npm run build` / `tsc` fail with existing TypeScript errors. There is no measured coverage percentage.

```bash
# Intended commands (currently fail on main)
npm test
npm run test:coverage
npm run test:unit
npm run test:integration
npm run typecheck
npm run lint
```

## 📈 Monitoring & Observability

### Logging

Structured JSON logging with configurable levels:

```javascript
// Application logs
{
  "timestamp": "2025-01-01T00:00:00.000Z",
  "level": "info",
  "message": "MCP Operation",
  "operation": "call_tool",
  "data": {...}
}

// Security logs
{
  "timestamp": "2025-01-01T00:00:00.000Z",
  "level": "warn",
  "message": "Security Event",
  "event": "rate_limit_exceeded",
  "severity": "high"
}
```

### Health Checks

- **Application Health**: `/health` endpoint
- **Docker Health**: Built-in container health checks
- **Process Monitoring**: Memory usage and process validation

### Metrics

- Request/response times
- Error rates and types
- Resource utilization
- Security event counts

## 🔄 Manus.im Integration

### Current Status

**Status: experimental. Tools currently return mock data; no live Manus.im API calls. Install, lint, test, and build currently fail on `main`; this project is not deployable as-is.**

The MCP tool `check_manus_credits` in `src/tools/manager.ts` always returns hardcoded mock credits and does not call Manus.im. `ManusIntegration` in `src/integrations/manus.ts` includes an axios client that would request `https://api.manus.run` (or `MANUS_API_URL`) when `MANUS_API_KEY` is set, but that class is not imported or used by the running server.

### Scaffolding (not live)

- Mock credit response from `check_manus_credits` (hardcoded; never hits Manus.im)
- Unused `ManusIntegration` methods for credits, tasks, and polling (live HTTP only if the class is instantiated with an API key)
- `mcp://manus/status` resource returns a hardcoded `pending_api_access` payload

### Integration Examples

The examples below call `ManusIntegration` directly. The MCP server does not use this class today.

```typescript
// Check credits
const credits = await manusIntegration.checkCredits();

// Execute text task
const result = await manusIntegration.executeTextTask("Analyze this data...");

// Execute code task
const output = await manusIntegration.executeCodeTask("console.log('Hello')", "javascript");
```

## 🚢 Deployment

Not deployable as-is: install, lint, test, and build currently fail on `main`. The items below are a future checklist, not a working production path.

### Future deployment checklist

- [ ] Restore a working `npm install` / `npm ci`
- [ ] Fix lint, tests, and `tsc` so the project builds
- [ ] Configure environment variables securely
- [ ] Set up SSL/TLS certificates
- [ ] Set up log aggregation and monitoring
- [ ] Set up security scanning and updates

### Scaling notes (not measured)

Kubernetes HPA and resource-limit manifests exist under `k8s/`. No load, latency, or capacity numbers have been measured.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

### Development Guidelines

- Follow TypeScript strict mode
- Add tests for new features
- Update documentation
- Follow security best practices
- Use conventional commit messages

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- **Documentation**: See `docs/` directory
- **Issues**: [GitHub Issues](https://github.com/your-org/mcp_manus/issues)
- **Security**: See [docs/SECURITY.md](docs/SECURITY.md) for security reporting
- **Discussions**: [GitHub Discussions](https://github.com/your-org/mcp_manus/discussions)

## 🏷️ Version History

- **v1.0.0** - Initial experimental release
  - OAuth 2.1 scaffolding (mock token paths remain)
  - Docker and Kubernetes files (unverified; project does not currently build)
  - Manus.im integration scaffolding (tools return mock data)
  - Security-related source and docs (not validated by a passing test/build)

---
