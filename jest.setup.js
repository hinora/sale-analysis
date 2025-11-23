// jest.setup.js
import '@testing-library/jest-dom';

// Mock environment variables
process.env.MONGODB_URI = 'mongodb://localhost:27017/test';
process.env.OLLAMA_BASE_URL = 'http://localhost:11434';

// Suppress console warnings in tests
global.console = {
  ...console,
  warn: jest.fn(),
  error: jest.fn(),
};
