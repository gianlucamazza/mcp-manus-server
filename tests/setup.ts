import { jest } from '@jest/globals';

// Global test setup
beforeAll(() => {
  // Set test environment variables
  process.env.NODE_ENV = 'test';
  process.env.LOG_LEVEL = 'error';
  process.env.JWT_SECRET = 'test-secret-key';
});

afterAll(() => {
  // Cleanup after all tests
  jest.clearAllMocks();
});

beforeEach(() => {
  // Reset modules before each test
  jest.resetModules();
});

afterEach(() => {
  // Clear all mocks after each test
  jest.clearAllMocks();
});

// Suppress console.log during tests unless LOG_LEVEL is debug
if (process.env.LOG_LEVEL !== 'debug') {
  global.console = {
    ...console,
    log: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
}