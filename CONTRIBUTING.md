# Contributing to MCP Manus Server

Thank you for your interest in contributing to the MCP Manus Server! This document provides guidelines and information for contributors.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Contributing Process](#contributing-process)
- [Code Standards](#code-standards)
- [Testing](#testing)
- [Security](#security)

## Code of Conduct

This project adheres to a code of conduct that we expect all contributors to follow. Please be respectful and constructive in all interactions.

## Getting Started

### Prerequisites

- Node.js 20+ with npm 9+
- Docker and Docker Compose
- Git
- TypeScript knowledge

### Development Setup

1. **Fork and clone the repository:**
   ```bash
   git clone https://github.com/your-username/mcp-manus-server.git
   cd mcp-manus-server
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Set up environment:**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Run development server:**
   ```bash
   npm run dev
   ```

5. **Run tests:**
   ```bash
   npm test
   ```

## Contributing Process

### 1. Issue First

- Check existing issues before creating new ones
- Use issue templates for bugs and feature requests
- Discuss major changes in issues before implementing

### 2. Branching Strategy

- Create feature branches from `main`
- Use descriptive branch names: `feature/oauth-improvements`, `fix/metrics-bug`
- Keep branches focused and atomic

### 3. Pull Request Process

1. **Create your branch:**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes:**
   - Follow code standards
   - Add tests
   - Update documentation

3. **Test your changes:**
   ```bash
   npm run test
   npm run lint
   npm run typecheck
   npm run security:deps
   ```

4. **Commit your changes:**
   ```bash
   git commit -m "type(scope): description
   
   Detailed explanation of changes
   
   🤖 Generated with [Claude Code](https://claude.ai/code)
   
   Co-Authored-By: Claude <noreply@anthropic.com>"
   ```

5. **Push and create PR:**
   ```bash
   git push origin feature/your-feature-name
   ```

### 4. Review Process

- All PRs require review
- Address feedback promptly
- Keep PRs up to date with main
- Squash commits when merging

## Code Standards

### TypeScript

- Use strict TypeScript configuration
- Prefer interfaces over types for object shapes
- Use proper type annotations
- Avoid `any` type

### Code Style

- Follow ESLint configuration
- Use Prettier for formatting
- Meaningful variable and function names
- Add JSDoc comments for public APIs

### Security

- Never commit secrets or credentials
- Use environment variables for configuration
- Validate all inputs
- Follow OWASP guidelines

### Performance

- Use async/await appropriately
- Avoid blocking operations
- Implement proper error handling
- Consider memory usage

## Testing

### Test Types

1. **Unit Tests** (`tests/unit/`)
   - Test individual functions and classes
   - Use Jest framework
   - Aim for >90% coverage

2. **Integration Tests** (`tests/integration/`)
   - Test component interactions
   - Test external API integrations
   - Use real or realistic data

3. **E2E Tests** (`tests/e2e/`)
   - Test complete user workflows
   - Use Playwright framework
   - Test critical paths

### Writing Tests

```typescript
describe('Feature', () => {
  beforeEach(() => {
    // Setup
  });

  it('should behave correctly', async () => {
    // Arrange
    const input = createTestInput();
    
    // Act
    const result = await functionUnderTest(input);
    
    // Assert
    expect(result).toMatchObject({
      expected: 'value'
    });
  });
});
```

### Test Coverage

- Maintain >90% code coverage
- Test error conditions
- Test edge cases
- Test security scenarios

## Security

### Security Guidelines

1. **Input Validation:**
   ```typescript
   const schema = z.object({
     input: z.string().min(1).max(100)
   });
   const validated = schema.parse(userInput);
   ```

2. **Error Handling:**
   ```typescript
   try {
     await riskyOperation();
   } catch (error) {
     logger.error('Operation failed', { error: error.message });
     throw new Error('Generic error message');
   }
   ```

3. **Secrets Management:**
   - Use environment variables
   - Never log sensitive data
   - Use proper secret rotation

### Security Testing

- Run security scans: `npm run security:deps`
- Test authentication flows
- Validate authorization
- Test rate limiting

## Documentation

### Code Documentation

- Add JSDoc comments for public APIs
- Document complex algorithms
- Include usage examples
- Keep documentation up to date

### API Documentation

- Update OpenAPI specifications
- Include request/response examples
- Document error codes
- Explain authentication

## Monitoring and Observability

### Metrics

When adding new features:

```typescript
import { metricsCollector } from '../monitoring/metrics.js';

// Record custom metrics
metricsCollector.recordMcpRequest('operation', 'resource', 'success', duration);
```

### Logging

Use structured logging:

```typescript
import { logger } from '../utils/logger.js';

logger.info('Operation completed', {
  operationType: 'user_action',
  userId: 'user123',
  duration: 150
});
```

## Release Process

### Versioning

- Follow Semantic Versioning (SemVer)
- Update CHANGELOG.md
- Tag releases properly

### Release Checklist

- [ ] All tests pass
- [ ] Security scan clean
- [ ] Documentation updated
- [ ] Version bumped
- [ ] Changelog updated
- [ ] Docker image builds
- [ ] Monitoring verified

## Getting Help

### Community

- GitHub Issues for bugs and features
- GitHub Discussions for questions
- Check existing documentation

### Development

- Review existing code for patterns
- Check test files for examples
- Follow TypeScript best practices

## Recognition

Contributors will be:
- Listed in CONTRIBUTORS.md
- Mentioned in release notes
- Credited in significant features

Thank you for contributing to making the MCP Manus Server better!