import { IntervalService, TickGuardReason } from '../src/domain.js';
import type { TickGuardOutcome } from '../src/types/index.js';

import { withTestExecutionContext } from './external-deps/couimet/execution-context-testing/index.js';

import { ExecutionContext } from '@couimet/execution-context';
import type { Logger } from '@couimet/logger-contract';
import { createMockLogger } from '@couimet/logger-contract-testing';
import { describe, expect, it, jest } from '@jest/globals';

const TICK_MS = 100;
const RETRY_AFTER_SEC = 5;
const RETRY_AFTER_MS = RETRY_AFTER_SEC * 1000;
const SUPPRESSION_MS = 3_000;
const TICK_ERROR = new Error('tick failure');
const JOB_CORRELATION_ID = 'test-job';
const OUTER_CORRELATION_ID = 'outer-correlation';
const OUTER_REQUEST_ID = 'outer-request';
const OUTER_VERSION = '1.2.3';

class StubService extends IntervalService {
  executeTickCalls = 0;

  constructor(log: Logger) {
    super(JOB_CORRELATION_ID, TICK_MS, log);
  }

  protected executeTick(): Promise<void> {
    this.executeTickCalls++;
    return Promise.resolve();
  }
}

class CapturingService extends IntervalService {
  capturedCorrelationId: string | undefined;
  capturedRequestId: string | undefined;
  capturedVersion: unknown;

  constructor(log: Logger) {
    super(JOB_CORRELATION_ID, TICK_MS, log);
  }

  protected executeTick(): Promise<void> {
    this.capturedCorrelationId = ExecutionContext.correlationId.toString();
    this.capturedRequestId = ExecutionContext.requestId.toString();
    this.capturedVersion = ExecutionContext.getAttribute('version');
    return Promise.resolve();
  }
}

class FailingService extends IntervalService {
  constructor(log: Logger) {
    super(JOB_CORRELATION_ID, TICK_MS, log);
  }

  protected executeTick(): Promise<void> {
    return Promise.reject(TICK_ERROR);
  }
}

class GatedService extends IntervalService {
  private readonly gate: Promise<void>;
  private release: (() => void) | null = null;

  constructor(log: Logger) {
    super(JOB_CORRELATION_ID, TICK_MS, log);
    this.gate = new Promise<void>((resolve) => {
      this.release = resolve;
    });
  }

  releaseGate(): void {
    this.release?.();
  }

  protected async executeTick(): Promise<void> {
    await this.gate;
  }
}

class RateLimitedService extends IntervalService {
  executeTickCalls = 0;
  retryAfterMs: number | undefined;

  constructor(log: Logger) {
    super(JOB_CORRELATION_ID, TICK_MS, log);
  }

  protected tickGuard(): TickGuardOutcome {
    const base = super.tickGuard();
    if (!base.allowed || this.retryAfterMs === undefined) {
      return base;
    }
    return { allowed: false, reason: TickGuardReason.rateLimit, retryAfterMs: this.retryAfterMs };
  }

  protected executeTick(): Promise<void> {
    this.executeTickCalls++;
    return Promise.resolve();
  }
}

describe('IntervalService', () => {
  it('fires ticks on the interval after bootstrap', async () => {
    jest.useFakeTimers();
    const log = createMockLogger();
    const svc = new StubService(log);

    const { stop } = await svc.start();
    const afterBootstrap = svc.executeTickCalls;
    expect(afterBootstrap).toBeGreaterThanOrEqual(1);

    jest.advanceTimersByTime(TICK_MS);
    await Promise.resolve();
    expect(svc.executeTickCalls).toBe(afterBootstrap + 1);

    jest.advanceTimersByTime(TICK_MS);
    await Promise.resolve();
    expect(svc.executeTickCalls).toBe(afterBootstrap + 2);

    await stop();
    jest.useRealTimers();
  });

  it('tickGuard reports the stopped reason when the service is stopped', async () => {
    const log = createMockLogger();
    const svc = new StubService(log);
    await svc.start();
    await svc['stop']();

    expect(svc['tickGuard']()).toStrictEqual({ allowed: false, reason: 'stopped', retryAfterMs: undefined });
  });

  it('tickGuard reports the in-flight reason when a tick is in flight', () => {
    const log = createMockLogger();
    const svc = new StubService(log);
    (svc as any).tickPromise = Promise.resolve();

    expect(svc['tickGuard']()).toStrictEqual({ allowed: false, reason: 'tick-in-flight', retryAfterMs: undefined });
  });

  it('tick returns early and logs the suppression when tickGuard blocks', async () => {
    const log = createMockLogger();
    const svc = new StubService(log);
    (svc as any).tickPromise = Promise.resolve();
    const initialCalls = svc.executeTickCalls;

    await svc['tick']();

    expect(svc.executeTickCalls).toBe(initialCalls);
    expect(log.warn).toHaveBeenCalledWith(
      { fn: 'IntervalService.tick', guard: 'tick-in-flight', retryAfterSec: undefined, suppressedTickCount: 1 },
      'Interval tick suppressed',
    );
  });

  it('thins the suppressed-tick line to the powers of two', async () => {
    jest.useFakeTimers();
    const log = createMockLogger();
    const svc = new RateLimitedService(log);
    svc.retryAfterMs = RETRY_AFTER_MS;

    for (let tickNumber = 0; tickNumber < 5; tickNumber++) {
      await svc['tick']();
    }

    expect(svc.executeTickCalls).toBe(0);
    expect(log.warn).toHaveBeenCalledTimes(3);
    expect(log.warn).toHaveBeenNthCalledWith(
      1,
      { fn: 'IntervalService.tick', guard: 'rate-limit', retryAfterSec: RETRY_AFTER_SEC, suppressedTickCount: 1 },
      'Interval tick suppressed',
    );
    expect(log.warn).toHaveBeenNthCalledWith(
      2,
      { fn: 'IntervalService.tick', guard: 'rate-limit', retryAfterSec: RETRY_AFTER_SEC, suppressedTickCount: 2 },
      'Interval tick suppressed',
    );
    expect(log.warn).toHaveBeenNthCalledWith(
      3,
      { fn: 'IntervalService.tick', guard: 'rate-limit', retryAfterSec: RETRY_AFTER_SEC, suppressedTickCount: 4 },
      'Interval tick suppressed',
    );

    jest.useRealTimers();
  });

  it('logs the resumption with the suppressed count and the elapsed time, then resets', async () => {
    jest.useFakeTimers();
    const log = createMockLogger();
    const svc = new RateLimitedService(log);
    svc.retryAfterMs = RETRY_AFTER_MS;

    await svc['tick']();
    await svc['tick']();
    jest.advanceTimersByTime(SUPPRESSION_MS);
    svc.retryAfterMs = undefined;
    await svc['tick']();

    expect(log.info).toHaveBeenCalledWith(
      { fn: 'IntervalService.tick', guard: 'rate-limit', suppressedTickCount: 2, suppressedMs: SUPPRESSION_MS },
      'Interval tick resumed after suppression',
    );

    await svc['tick']();
    expect(log.info).toHaveBeenCalledTimes(1);

    jest.useRealTimers();
  });

  it('writes no resumption line when no tick was suppressed', async () => {
    const log = createMockLogger();
    const svc = new StubService(log);

    await svc['tick']();

    expect(log.info).not.toHaveBeenCalled();
  });

  it('logs the wall-clock gap when the tick runs more than one interval late', async () => {
    jest.useFakeTimers();
    const log = createMockLogger();
    const svc = new StubService(log);

    await svc['tick']();
    jest.advanceTimersByTime(TICK_MS * 3);
    await svc['tick']();

    expect(log.warn).toHaveBeenCalledWith(
      { fn: 'IntervalService.tick', gapMs: TICK_MS * 2 },
      'Interval tick ran late; the wall clock passed the expected tick time',
    );

    jest.useRealTimers();
  });

  it('writes no gap line when the tick is one interval late', async () => {
    jest.useFakeTimers();
    const log = createMockLogger();
    const svc = new StubService(log);

    await svc['tick']();
    jest.advanceTimersByTime(TICK_MS * 2);
    await svc['tick']();

    expect(log.warn).not.toHaveBeenCalled();

    jest.useRealTimers();
  });

  it('writes no gap line on the first tick', async () => {
    const log = createMockLogger();
    const svc = new StubService(log);

    await svc['tick']();

    expect(log.warn).not.toHaveBeenCalled();
  });

  it('logs a warning and continues when executeTick throws', async () => {
    jest.useFakeTimers();
    const log = createMockLogger();
    const svc = new FailingService(log);

    await svc.start();

    expect(log.warn).toHaveBeenCalledWith({ fn: 'IntervalService.tick', error: TICK_ERROR }, 'executeTick threw; continuing');
    expect(svc['stopped']).toBe(false);

    await svc['stop']();
  });

  it('runs a tick inside a run carrying the job correlation id and a generated request id', async () => {
    const log = createMockLogger();
    const svc = new CapturingService(log);

    await svc.start();
    await svc['stop']();

    expect(svc.capturedCorrelationId).toBe(JOB_CORRELATION_ID);
    expect(svc.capturedRequestId).toBeDefined();
  });

  it('gives consecutive ticks different request ids', async () => {
    jest.useFakeTimers();
    const log = createMockLogger();
    const svc = new CapturingService(log);

    await svc.start();
    const firstRequestId = svc.capturedRequestId;

    jest.advanceTimersByTime(TICK_MS);
    await Promise.resolve();
    const secondRequestId = svc.capturedRequestId;

    expect(secondRequestId).not.toBe(firstRequestId);
    expect(svc.capturedCorrelationId).toBe(JOB_CORRELATION_ID);

    await svc['stop']();
    jest.useRealTimers();
  });

  it('inherits outer attributes while the tick ids replace the outer ids', async () => {
    const log = createMockLogger();
    const svc = new CapturingService(log);

    await withTestExecutionContext({ correlationId: OUTER_CORRELATION_ID, requestId: OUTER_REQUEST_ID, attributes: { version: OUTER_VERSION } }, async () => {
      await svc.start();
      await svc['stop']();
    });

    expect(svc.capturedCorrelationId).toBe(JOB_CORRELATION_ID);
    expect(svc.capturedRequestId).toBeDefined();
    expect(svc.capturedRequestId).not.toBe(OUTER_REQUEST_ID);
    expect(svc.capturedVersion).toBe(OUTER_VERSION);
  });

  it('bootstrapTick awaits an in-flight tick instead of starting a second one', async () => {
    const log = createMockLogger();
    const svc = new GatedService(log);

    svc['tick']();
    let bootstrapped = false;
    const bootstrapPromise = svc.bootstrapTick().then(() => {
      bootstrapped = true;
    });
    await Promise.resolve();
    expect(bootstrapped).toBe(false);

    svc.releaseGate();
    await bootstrapPromise;
    expect(bootstrapped).toBe(true);
  });

  it('start awaits the initial tick before setting up the interval', async () => {
    const log = createMockLogger();
    const svc = new GatedService(log);

    const startPromise = svc.start();
    let startSettled = false;
    void startPromise.then(() => {
      startSettled = true;
    });
    await Promise.resolve();
    expect(startSettled).toBe(false);

    svc.releaseGate();
    const { stop } = await startPromise;
    await stop();
  });

  it('stop awaits an in-flight tick before calling onStop', async () => {
    const log = createMockLogger();
    const svc = new GatedService(log);

    svc['tick']();
    const tickPromise = svc['tickPromise'];
    expect(tickPromise).toBeDefined();

    let stopped = false;
    const stopPromise = svc['stop']().then(() => {
      stopped = true;
    });
    await Promise.resolve();
    expect(stopped).toBe(false);

    svc.releaseGate();
    await stopPromise;
    expect(stopped).toBe(true);
    expect(svc['stopped']).toBe(true);
  });
});
