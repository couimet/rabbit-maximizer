import { ExecutionContext } from '../src/external-deps/couimet/execution-context/src/index.js';

import { getUniqueString, getUuid } from '@couimet/dynamic-testing';
import type { Logger } from '@couimet/logger-contract';
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
  const DEBUG_LOG_LEVEL = 'debug';

  it('builds dual-target pino transport (pino-roll + pino-pretty), wraps it in PinoAdapter, and registers a logger that delegates to it', () => {
    const mockTransport = {};
    mockTransportFn.mockReturnValue(mockTransport);
    mockPinoFn.mockReturnValue(mockPinoLogger);
    MockPinoAdapter.mockImplementation(() => mockPinoLogger);

    initLogger();

    expect(mockTransportFn).toHaveBeenCalledWith({
      targets: [
        { target: 'pino-roll', options: { file: './logs/rabbit-maximizer.log', frequency: 'daily', mkdir: true, limit: { count: 7 } }, level: 'debug' },
        { target: 'pino-pretty', options: { destination: 1, colorize: true }, level: 'debug' },
      ],
    });

    expect(mockPinoFn).toHaveBeenCalledWith({ level: 'debug' }, mockTransport);
    expect(MockPinoAdapter).toHaveBeenCalledWith(mockPinoLogger);
    expect(mockSetLogger).toHaveBeenCalledTimes(1);

    const registeredLogger = mockSetLogger.mock.calls[0][0] as Logger;
    registeredLogger.debug({ fn: 'test', source: 'test' }, 'delegated to adapter');
    expect(mockPinoLogger.debug).toHaveBeenCalledWith({ fn: 'test', source: 'test' }, 'delegated to adapter');
  });

  it('uses LOG_LEVEL env var over the debug default when set', () => {
    const prev = process.env.LOG_LEVEL;
    process.env.LOG_LEVEL = DEBUG_LOG_LEVEL;

    try {
      const mockTransport = {};
      mockTransportFn.mockReturnValue(mockTransport);
      mockPinoFn.mockReturnValue(mockPinoLogger);

      initLogger();

      expect(mockPinoFn).toHaveBeenCalledWith({ level: DEBUG_LOG_LEVEL }, mockTransport);
    } finally {
      process.env.LOG_LEVEL = prev;
    }
  });

  it('registers a logger that merges ambient execution-context attributes into every call', () => {
    const correlationId = getUuid();
    const requestId = getUuid();
    const version = getUniqueString();
    const extra = getUniqueString();
    mockTransportFn.mockReturnValue({});
    mockPinoFn.mockReturnValue(mockPinoLogger);
    MockPinoAdapter.mockImplementation(() => mockPinoLogger);

    initLogger();
    const registeredLogger = mockSetLogger.mock.calls[0][0] as Logger;

    ExecutionContext.run({ correlationId, requestId, attributes: { version } }, () => {
      registeredLogger.info({ fn: 'test', extra }, 'ambient context merged');
    });

    expect(mockPinoLogger.info).toHaveBeenCalledWith(
      { fn: 'test', correlation_id: correlationId, request_id: requestId, version, extra },
      'ambient context merged',
    );
  });
});
