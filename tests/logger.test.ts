import { describe, expect, it, jest } from '@jest/globals';

const mockPinoLogger = { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() };
const mockPinoFn = jest.fn();
const mockTransportFn = jest.fn();

jest.unstable_mockModule('pino', () => ({
  default: Object.assign(mockPinoFn, { transport: mockTransportFn }),
}));

const mockSetLogger = jest.fn();

jest.unstable_mockModule('@couimet/logger-contract', () => ({
  setLogger: mockSetLogger,
}));

const MockPinoAdapter = jest.fn();

jest.unstable_mockModule('@couimet/logger-contract-adapters', () => ({
  PinoAdapter: MockPinoAdapter,
}));

const { initLogger } = await import('../src/logger.js');

describe('initLogger', () => {
  it('builds dual-target pino transport (pino-roll + pino-pretty), wraps it in PinoAdapter, and registers via setLogger', () => {
    const mockTransport = {};
    mockTransportFn.mockReturnValue(mockTransport);
    mockPinoFn.mockReturnValue(mockPinoLogger);

    initLogger();

    expect(mockTransportFn).toHaveBeenCalledWith({
      targets: [
        { target: 'pino-roll', options: { file: './logs/rabbit-maximizer.log', frequency: 'daily', mkdir: true, limit: { count: 7 } } },
        { target: 'pino-pretty', options: { destination: 1, colorize: true } },
      ],
    });

    expect(mockPinoFn).toHaveBeenCalledWith(mockTransport);
    expect(MockPinoAdapter).toHaveBeenCalledWith(mockPinoLogger);
    expect(mockSetLogger).toHaveBeenCalledWith(MockPinoAdapter.mock.instances[0]);
  });
});
