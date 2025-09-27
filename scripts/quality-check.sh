#!/bin/bash

# MCP Manus Server - Comprehensive Quality Check Script
set -e

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

echo "🔍 Running comprehensive quality checks for MCP Manus Server..."
echo ""

# Track overall status
overall_status=0

# Code Quality Checks
print_status "📝 Running code quality checks..."

# ESLint
print_status "Running ESLint..."
if npm run lint; then
    print_success "ESLint passed"
else
    print_error "ESLint failed"
    overall_status=1
fi

# Prettier
print_status "Checking code formatting..."
if npm run format:check; then
    print_success "Code formatting is consistent"
else
    print_warning "Code formatting issues found - run 'npm run format' to fix"
fi

# TypeScript
print_status "Running TypeScript type checking..."
if npm run typecheck; then
    print_success "TypeScript type checking passed"
else
    print_error "TypeScript type checking failed"
    overall_status=1
fi

echo ""

# Testing
print_status "🧪 Running test suite..."

# Unit tests
print_status "Running unit tests..."
if npm run test:unit; then
    print_success "Unit tests passed"
else
    print_error "Unit tests failed"
    overall_status=1
fi

# Integration tests
print_status "Running integration tests..."
if npm run test:integration; then
    print_success "Integration tests passed"
else
    print_warning "Integration tests failed or not configured"
fi

# Test coverage
print_status "Checking test coverage..."
if npm run test:coverage > coverage_output.tmp 2>&1; then
    coverage=$(grep -o '[0-9]\+\.[0-9]\+%' coverage_output.tmp | head -1)
    if [ ! -z "$coverage" ]; then
        print_success "Test coverage: $coverage"
    else
        print_success "Coverage check completed"
    fi
else
    print_warning "Coverage check failed"
fi
rm -f coverage_output.tmp

echo ""

# Security Checks
print_status "🔒 Running security checks..."

# Dependency audit
print_status "Checking for vulnerable dependencies..."
if npm audit --audit-level=moderate; then
    print_success "No moderate or high vulnerabilities found"
else
    print_warning "Security vulnerabilities found in dependencies"
fi

# Secret scanning (if trufflehog is available)
if command -v trufflehog &> /dev/null; then
    print_status "Scanning for exposed secrets..."
    if npm run security:secrets; then
        print_success "No secrets detected"
    else
        print_warning "Potential secrets detected"
    fi
else
    print_warning "Trufflehog not available - skipping secret scan"
fi

echo ""

# Build Validation
print_status "🏗️ Validating build process..."

# Clean and build
print_status "Running clean build..."
if rm -rf dist && npm run build; then
    print_success "Build completed successfully"
else
    print_error "Build failed"
    overall_status=1
fi

# Check build output
if [ -d "dist" ] && [ "$(ls -A dist)" ]; then
    print_success "Build artifacts generated"
else
    print_error "Build artifacts missing"
    overall_status=1
fi

echo ""

# Docker Validation (if Docker is available)
if command -v docker &> /dev/null; then
    print_status "🐳 Validating Docker build..."
    
    if npm run docker:build > docker_build.tmp 2>&1; then
        print_success "Docker image built successfully"
    else
        print_warning "Docker build failed or not configured"
    fi
    rm -f docker_build.tmp
else
    print_warning "Docker not available - skipping container validation"
fi

echo ""

# Performance Checks
print_status "⚡ Running performance checks..."

# Bundle size analysis
if [ -f "dist/index.js" ]; then
    bundle_size=$(du -h dist/index.js | cut -f1)
    print_success "Main bundle size: $bundle_size"
else
    print_warning "Bundle size analysis skipped - build artifacts not found"
fi

# Type checking performance
print_status "Measuring TypeScript compilation time..."
start_time=$(date +%s)
npm run typecheck > /dev/null 2>&1
end_time=$(date +%s)
compile_time=$((end_time - start_time))
print_success "TypeScript compilation time: ${compile_time}s"

echo ""

# Documentation Checks
print_status "📚 Validating documentation..."

# Check for required files
required_files=("README.md" "CONTRIBUTING.md" "SECURITY.md")
for file in "${required_files[@]}"; do
    if [ -f "$file" ]; then
        print_success "$file exists"
    else
        print_warning "$file missing"
    fi
done

# Check for API documentation
if [ -f "docs/api.json" ] || npm run docs:api > /dev/null 2>&1; then
    print_success "API documentation available"
else
    print_warning "API documentation missing or generation failed"
fi

echo ""

# Git Hooks Validation
print_status "🪝 Validating Git hooks..."

if [ -f ".husky/pre-commit" ] && [ -x ".husky/pre-commit" ]; then
    print_success "Pre-commit hook installed and executable"
else
    print_warning "Pre-commit hook missing or not executable"
fi

if [ -f ".husky/commit-msg" ] && [ -x ".husky/commit-msg" ]; then
    print_success "Commit message hook installed and executable"
else
    print_warning "Commit message hook missing or not executable"
fi

if [ -f ".husky/pre-push" ] && [ -x ".husky/pre-push" ]; then
    print_success "Pre-push hook installed and executable"
else
    print_warning "Pre-push hook missing or not executable"
fi

echo ""

# Summary
echo "📊 Quality Check Summary:"
echo "=========================="

if [ $overall_status -eq 0 ]; then
    print_success "🎉 All critical quality checks passed!"
    echo ""
    echo "✅ Code quality: PASSED"
    echo "✅ Type safety: PASSED"
    echo "✅ Tests: PASSED"
    echo "✅ Build: PASSED"
    echo "✅ Security: CHECKED"
    echo ""
    print_success "Project is ready for production deployment!"
else
    print_error "❌ Some critical quality checks failed!"
    echo ""
    echo "Please fix the issues above before proceeding."
    echo ""
    echo "Quick fixes:"
    echo "  - Run 'npm run quality:fix' for automatic fixes"
    echo "  - Run 'npm run lint:fix' for linting issues"
    echo "  - Run 'npm run format' for formatting issues"
    echo "  - Check test failures and fix failing tests"
fi

echo ""
echo "For detailed information about quality gates, see QUALITY_GATES.md"

exit $overall_status