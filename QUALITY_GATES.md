# Quality Gates Documentation

## 🎯 Overview

The MCP Manus Server implements comprehensive quality gates following 2025 best practices to ensure code quality, security, and consistency throughout the development lifecycle.

## 🏗️ Quality Gate Architecture

```text
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Developer     │───▶│   Pre-commit    │───▶│   Commit-msg    │
│   git commit    │    │   Lint-staged   │    │   Conventional  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Pre-push      │───▶│   CI Pipeline   │───▶│   Deployment    │
│   Full Tests    │    │   Security Scan │    │   Quality Gate  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 🪝 Git Hooks

### Pre-commit Hook (`.husky/pre-commit`)

**Purpose**: Validates staged changes before commit
**Runs**: On every `git commit`

**Checks Performed**:
- **ESLint**: Code linting and style enforcement
- **Prettier**: Code formatting consistency  
- **TypeScript**: Type checking on changed files
- **Jest**: Unit tests for related components
- **File validation**: Ensures no large files or sensitive data

**Configuration**: `lint-staged` in `package.json`

```json
{
  "lint-staged": {
    "*.{ts,js}": [
      "eslint --fix",
      "prettier --write",
      "git add"
    ],
    "*.{json,md,yml,yaml}": [
      "prettier --write",
      "git add"
    ],
    "*.{ts,tsx}": [
      "bash -c 'npm run typecheck'"
    ],
    "src/**/*.{ts,js}": [
      "jest --bail --findRelatedTests --passWithNoTests"
    ]
  }
}
```

### Commit Message Hook (`.husky/commit-msg`)

**Purpose**: Validates commit message format
**Runs**: On every `git commit`

**Validates**:
- **Conventional Commits**: Follows standard format
- **Length limits**: Header ≤ 72 chars, body ≤ 100 chars per line
- **Required components**: Type, description
- **Warning patterns**: Detects TODO, FIXME, DEBUG keywords

**Conventional Commit Format**:
```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

**Valid Types**:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks
- `perf`: Performance improvements
- `ci`: CI/CD changes
- `build`: Build system changes
- `revert`: Reverting changes

**Examples**:
```bash
feat: add correlation ID support to logging system
fix(auth): resolve OAuth token validation issue
docs: update README with deployment instructions
style: format code with prettier
refactor(mcp): extract common server utilities
```

### Pre-push Hook (`.husky/pre-push`)

**Purpose**: Comprehensive validation before pushing
**Runs**: On every `git push`

**Branch-specific Behavior**:

**Main Branch Push**:
- ✅ All unit tests
- ✅ All integration tests  
- ✅ TypeScript compilation
- ✅ Security dependency audit
- ✅ Build validation
- ✅ Container build (if Docker available)

**Feature Branch Push**:
- ✅ Unit tests only
- ✅ TypeScript compilation
- ⚠️  Quick validation for faster development

## 🔍 Quality Checks

### Code Quality

#### ESLint Configuration
```json
{
  "extends": [
    "@typescript-eslint/recommended",
    "prettier"
  ],
  "plugins": [
    "@typescript-eslint",
    "security"
  ],
  "rules": {
    "@typescript-eslint/no-explicit-any": "error",
    "@typescript-eslint/explicit-function-return-type": "warn",
    "security/detect-object-injection": "error"
  }
}
```

#### TypeScript Strict Mode
```json
{
  "compilerOptions": {
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true
  }
}
```

### Testing Standards

#### Coverage Requirements
- **Minimum**: 80% overall coverage
- **Critical paths**: 90% coverage required
- **New code**: 95% coverage required

#### Test Categories
1. **Unit Tests**: Individual function/class testing
2. **Integration Tests**: Component interaction testing
3. **E2E Tests**: Complete workflow testing
4. **Performance Tests**: Load and stress testing

### Security Checks

#### Dependency Auditing
```bash
# High and critical vulnerabilities block deployment
npm audit --audit-level=high

# Regular security updates
npm audit fix
```

#### Secret Scanning
```bash
# Scan for exposed secrets
trufflehog git file://. --only-verified

# Pre-commit secret prevention
detect-secrets scan --all-files
```

### Performance Standards

#### Build Performance
- **TypeScript compilation**: < 30 seconds
- **Test execution**: < 2 minutes  
- **Bundle size**: < 5MB
- **Container build**: < 5 minutes

#### Runtime Performance
- **Startup time**: < 5 seconds
- **Memory usage**: < 512MB baseline
- **API response time**: < 100ms p95

## 🚀 Usage Guide

### Development Workflow

#### Standard Development
```bash
# 1. Make changes
git add .

# 2. Commit (triggers pre-commit hook)
git commit -m "feat: add new authentication feature"

# 3. Push (triggers pre-push hook)
git push origin feature/auth-enhancement
```

#### Quality Checks

#### Manual Quality Validation
```bash
# Run all quality checks
npm run quality:check

# Quick fixes
npm run quality:fix

# Individual checks
npm run lint
npm run typecheck
npm run test
npm run format:check
```

#### Hook Management
```bash
# Install/reinstall hooks
npm run hooks:install

# Test hooks without committing
npm run hooks:test

# Bypass hooks (emergency only)
git commit --no-verify -m "emergency: hotfix"
git push --no-verify origin main
```

### CI/CD Integration

#### GitHub Actions Integration
```yaml
# .github/workflows/quality.yml
- name: Quality Gates
  run: |
    npm run quality:check
    npm run test:coverage
    npm run security:deps
```

#### Quality Gate Failures
- **Blocks merge**: PR cannot be merged if quality gates fail
- **Automatic fixes**: Some issues auto-fixed by hooks
- **Manual intervention**: Critical issues require developer action

## 📊 Quality Metrics

### Tracking Quality Health

#### Code Quality Metrics
- **ESLint issues**: Track violations over time
- **Type coverage**: Percentage of typed code
- **Complexity**: Cyclomatic complexity scores
- **Duplication**: Code duplication percentage

#### Test Metrics
- **Coverage trends**: Track coverage over time
- **Test execution time**: Monitor performance
- **Test reliability**: Track flaky tests
- **Mutation testing**: Code quality validation

#### Security Metrics
- **Vulnerability count**: Track security issues
- **Dependency freshness**: Monitor outdated packages
- **Secret exposure**: Track potential secret leaks
- **Security hotspots**: Identify risky code areas

### Quality Dashboard

#### Daily Quality Report
```bash
# Generate quality report
npm run quality:report

# Key metrics tracked:
# - Code coverage percentage
# - ESLint violation count
# - TypeScript error count
# - Security vulnerability count
# - Test execution time
# - Build success rate
```

## 🔧 Configuration

### Customizing Quality Gates

#### Adjusting ESLint Rules
```javascript
// .eslintrc.json
{
  "rules": {
    "complexity": ["error", 10],
    "max-lines": ["error", 300],
    "max-depth": ["error", 4]
  }
}
```

#### Test Coverage Thresholds
```javascript
// jest.config.js
module.exports = {
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    },
    "./src/critical/": {
      branches: 90,
      functions: 90,
      lines: 90,
      statements: 90
    }
  }
};
```

### Environment-specific Configuration

#### Development
- **Relaxed rules**: Warnings instead of errors for some rules
- **Fast feedback**: Quick checks prioritized
- **Debug mode**: Additional logging and validation

#### CI/CD
- **Strict enforcement**: All rules are errors
- **Comprehensive checks**: Full test suite required
- **Security focus**: Enhanced security scanning

#### Production
- **Zero tolerance**: No warnings or errors allowed
- **Performance monitoring**: Runtime quality tracking
- **Audit trails**: Complete quality check logging

## 🛠️ Troubleshooting

### Common Issues

#### Hook Not Running
```bash
# Reinstall Husky
rm -rf .husky
npm run prepare

# Check permissions
chmod +x .husky/*

# Verify Git config
git config core.hooksPath .husky
```

#### ESLint Errors
```bash
# Auto-fix issues
npm run lint:fix

# Check specific file
npx eslint src/problematic-file.ts

# Disable rule for line
// eslint-disable-next-line @typescript-eslint/no-explicit-any
```

#### TypeScript Errors
```bash
# Full type check
npm run typecheck

# Incremental build
npx tsc --incremental

# Clear cache
rm -rf node_modules/.cache
```

#### Test Failures
```bash
# Run specific test
npm test -- --testPathPattern=failing-test

# Debug mode
npm test -- --verbose --detectOpenHandles

# Update snapshots
npm test -- --updateSnapshot
```

### Emergency Procedures

#### Bypassing Quality Gates
```bash
# Bypass pre-commit (use sparingly)
git commit --no-verify -m "emergency: critical hotfix"

# Bypass pre-push (use very sparingly)
git push --no-verify origin main

# Emergency deployment (bypass all checks)
SKIP_QUALITY_GATES=true npm run deploy
```

#### Quality Gate Recovery
```bash
# After emergency bypass, fix quality issues
npm run quality:fix
git add .
git commit -m "fix: address quality gate issues"

# Comprehensive cleanup
npm run quality:check
npm run test:coverage
npm run security:deps
```

## 📈 Continuous Improvement

### Quality Evolution
- **Regular reviews**: Monthly quality gate assessment
- **Rule updates**: Quarterly rule evaluation and updates
- **Tool updates**: Keep quality tools current
- **Best practices**: Adopt new industry standards

### Team Training
- **Onboarding**: Quality gate training for new developers
- **Workshops**: Regular quality improvement sessions
- **Documentation**: Keep quality guides updated
- **Knowledge sharing**: Share quality insights across teams

This comprehensive quality gate system ensures that the MCP Manus Server maintains the highest standards of code quality, security, and maintainability throughout its development lifecycle.