import { jest } from '@jest/globals';

interface MockVite {
  createServer: jest.Mock<any>;
}

export const createMockVite = (overrides: Partial<MockVite> = {}): MockVite => ({
  createServer: jest.fn(),
  ...overrides,
});
