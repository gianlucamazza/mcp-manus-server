#!/bin/bash

# MCP Manus Server - Quality Gates Setup Script
# This script sets up comprehensive development quality gates

set -e

echo "🚀 Setting up MCP Manus Server Quality Gates..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    print_error "package.json not found. Please run this script from the project root."
    exit 1
fi

# Check Node.js version
print_status "Checking Node.js version..."
node_version=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$node_version" -lt 18 ]; then
    print_error "Node.js 18+ is required. Current version: $(node --version)"
    exit 1
fi
print_success "Node.js version check passed: $(node --version)"

# Install dependencies
print_status "Installing dependencies..."
npm ci

# Setup Husky
print_status "Setting up Husky git hooks..."
npm run prepare

# Verify Husky installation
if [ ! -d ".husky" ]; then
    print_error "Husky setup failed. .husky directory not found."
    exit 1
fi

# Make hook scripts executable
chmod +x .husky/pre-commit
chmod +x .husky/commit-msg
chmod +x .husky/pre-push

print_success "Husky git hooks configured"

# Setup Git configuration
print_status "Configuring Git settings..."

# Set core.hooksPath to use Husky
git config core.hooksPath .husky

# Configure Git to use the hooks
git config advice.ignoredHook false

print_success "Git configuration updated"

# Validate quality tools
print_status "Validating quality tools..."

# Check ESLint
if ! npx eslint --version > /dev/null 2>&1; then
    print_error "ESLint not available"
    exit 1
fi

# Check TypeScript
if ! npx tsc --version > /dev/null 2>&1; then
    print_error "TypeScript not available"
    exit 1
fi

# Check Prettier
if ! npx prettier --version > /dev/null 2>&1; then
    print_error "Prettier not available"
    exit 1
fi

# Check Jest
if ! npx jest --version > /dev/null 2>&1; then
    print_error "Jest not available"
    exit 1
fi

print_success "All quality tools validated"

# Test the quality gates
print_status "Testing quality gates..."

# Test linting
print_status "Testing ESLint..."
if npm run lint > /dev/null 2>&1; then
    print_success "ESLint check passed"
else
    print_warning "ESLint found issues (this is normal for setup)"
fi

# Test type checking
print_status "Testing TypeScript..."
if npm run typecheck > /dev/null 2>&1; then
    print_success "TypeScript check passed"
else
    print_warning "TypeScript found issues (this is normal for setup)"
fi

# Test formatting
print_status "Testing Prettier..."
if npm run format:check > /dev/null 2>&1; then
    print_success "Prettier check passed"
else
    print_warning "Prettier found formatting issues (this is normal for setup)"
fi

# Create quality gates documentation
print_status "Creating quality gates documentation..."

cat > QUALITY_GATES.md << 'EOF'
# Quality Gates Documentation

## Overview

This project uses comprehensive quality gates to ensure code quality, security, and consistency.

## Git Hooks

### Pre-commit Hook
- Runs `lint-staged` for incremental checks
- Validates only staged files
- Automatically fixes formatting issues
- Blocks commit if critical issues found

### Commit Message Hook
- Validates conventional commit format
- Enforces structured commit messages
- Warns about potential issues (TODO, FIXME, etc.)

### Pre-push Hook
- **Main branch**: Full validation (tests, typecheck, security, build)
- **Feature branches**: Quick validation (unit tests)
- Prevents broken code from reaching main

## Quality Checks

### Code Quality
- **ESLint**: Code linting and style enforcement
- **Prettier**: Code formatting consistency
- **TypeScript**: Type checking and safety

### Testing
- **Unit Tests**: Jest-based unit testing
- **Integration Tests**: Component integration testing
- **E2E Tests**: Playwright end-to-end testing

### Security
- **Dependency Audit**: npm audit for vulnerable packages
- **Secret Scanning**: Trufflehog for exposed secrets
- **Container Scanning**: Trivy for Docker security

### Performance
- **Build Validation**: Ensures code compiles correctly
- **Type Performance**: TypeScript compilation speed
- **Bundle Analysis**: Build size optimization

## Usage

### Developer Workflow
1. Write code
2. Stage changes: `git add .`
3. Commit: `git commit -m "feat: add new feature"`
4. Push: `git push origin feature-branch`

### Bypassing Hooks (Emergency Only)
```bash
# Skip pre-commit (NOT RECOMMENDED)
git commit --no-verify -m "emergency fix"

# Skip pre-push (NOT RECOMMENDED)
git push --no-verify origin main
```

### Manual Quality Checks
```bash
# Run all quality checks
npm run quality:check

# Fix formatting issues
npm run format

# Fix linting issues
npm run lint:fix

# Run full test suite
npm run test
```

## Troubleshooting

### Hook Not Running
```bash
# Reinstall Husky
rm -rf .husky
npm run prepare
```

### Permission Issues
```bash
# Fix hook permissions
chmod +x .husky/*
```

### False Positives
```bash
# Update quality rules
npm run quality:update
```
EOF

print_success "Quality gates documentation created"

# Create a quality check script
print_status "Creating quality check script..."

cat > scripts/quality-check.sh << 'EOF'
#!/bin/bash

# Comprehensive quality check script
set -e

echo "🔍 Running comprehensive quality checks..."

# Code quality
echo "📝 Checking code quality..."
npm run lint
npm run format:check
npm run typecheck

# Testing
echo "🧪 Running tests..."
npm run test

# Security
echo "🔒 Running security checks..."
npm run security:deps

# Build
echo "🏗️ Validating build..."
npm run build

echo "✅ All quality checks passed!"
EOF

chmod +x scripts/quality-check.sh

print_success "Quality check script created"

# Update package.json scripts
print_status "Updating package.json scripts..."

# Add quality scripts to package.json using a temporary approach
npm pkg set scripts.quality:check="./scripts/quality-check.sh"
npm pkg set scripts.quality:fix="npm run lint:fix && npm run format"
npm pkg set scripts.hooks:install="husky install"
npm pkg set scripts.hooks:update="husky add .husky/pre-commit 'npx lint-staged' && husky add .husky/commit-msg 'npx --no-install commitlint --edit \$1'"

print_success "Package.json scripts updated"

# Final validation
print_status "Running final validation..."

# Test commit message validation
echo "test: validate quality gates setup" > test_commit_msg.tmp
if .husky/commit-msg test_commit_msg.tmp > /dev/null 2>&1; then
    print_success "Commit message validation working"
else
    print_error "Commit message validation failed"
fi
rm -f test_commit_msg.tmp

# Summary
echo ""
echo "🎉 Quality Gates Setup Complete!"
echo ""
echo "📋 Summary:"
echo "  ✅ Husky git hooks installed"
echo "  ✅ Pre-commit, commit-msg, pre-push hooks configured"
echo "  ✅ Quality tools validated"
echo "  ✅ Documentation created"
echo "  ✅ Helper scripts generated"
echo ""
echo "📖 Next steps:"
echo "  1. Read QUALITY_GATES.md for usage instructions"
echo "  2. Try making a commit to test the hooks"
echo "  3. Run 'npm run quality:check' for manual validation"
echo ""
print_success "Setup completed successfully!"
EOF

chmod +x /Users/gianlucamazza/Workspace/mcp_manus/scripts/setup-quality-gates.sh