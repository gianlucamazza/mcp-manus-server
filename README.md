# MCP Manus Server

A production-ready Model Context Protocol (MCP) server with Manus.im integration, built following 2025 best practices for security, containerization, and scalability.

## 🚀 Features

- **MCP Compliance**: Implements the latest Model Context Protocol specification (2025-06-18)
- **Manus.im Integration**: Ready for Manus.im API integration with credit management and task execution
- **OAuth 2.1 Security**: Modern authentication with PKCE and resource indicators
- **Docker Security**: Multi-stage builds, non-root execution, and security hardening
- **TypeScript**: Full type safety with modern ES modules and Node.js 20+
- **Comprehensive Testing**: Unit, integration, and schema validation tests
- **Production Monitoring**: Structured logging, health checks, and audit trails

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

### Prerequisites

- Node.js 20+
- Docker & Docker Compose
- Git

### Development Setup

1. **Clone and install dependencies:**

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

### Docker Deployment

1. **Build and run with Docker Compose:**

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

This server implements comprehensive security measures following 2025 best practices:

- **Container Security**: Non-root execution, read-only filesystem, capability restrictions
- **Network Security**: Rate limiting, security headers, network isolation
- **Authentication**: OAuth 2.1 with PKCE, JWT validation, resource indicators
- **Authorization**: Tool/resource access controls, path validation, audit logging
- **Input Validation**: Zod schema validation, sanitization, type safety

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

```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Run specific test suites
npm run test:unit
npm run test:integration

# Type checking
npm run typecheck

# Linting
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

The Manus.im integration is **ready for deployment** but currently operates with mock data since the API is in private beta.

### Features Ready

- ✅ Credit tracking and management
- ✅ Task creation and execution
- ✅ Multimodal support (text, image, code, file, web)
- ✅ Real-time task status monitoring
- ✅ Error handling and retry logic

### Integration Examples

```typescript
// Check credits
const credits = await manusIntegration.checkCredits();

// Execute text task
const result = await manusIntegration.executeTextTask("Analyze this data...");

// Execute code task
const output = await manusIntegration.executeCodeTask("console.log('Hello')", "javascript");
```

## 🚢 Deployment

### Production Deployment Checklist

- [ ] Configure environment variables securely
- [ ] Set up SSL/TLS certificates
- [ ] Configure proper firewall rules
- [ ] Set up log aggregation and monitoring
- [ ] Configure automated backups
- [ ] Test disaster recovery procedures
- [ ] Set up security scanning and updates

### Scaling Considerations

- **Horizontal Scaling**: Deploy multiple instances behind load balancer
- **Resource Limits**: Configure CPU/memory limits based on usage
- **Rate Limiting**: Adjust rate limits based on expected load
- **Caching**: Implement Redis for session/token caching if needed

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

- **v1.0.0** - Initial release with MCP 2025 compliance
  - OAuth 2.1 authentication
  - Docker containerization
  - Manus.im integration ready
  - Comprehensive security implementation

---
