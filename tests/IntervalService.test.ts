import { IntervalService } from '../src/domain.js';

import type { Logger } from '@couimet/logger-contract';
import { createMockLogger } from '@couimet/logger-contract-testing';
import { describe, expect, it, jest } from '@jest/globals';

const TICK_MS = 100;
const TICK_ERROR = new Error('tick failure');

class StubService extends IntervalService {
  executeTickCalls = 0;

  constructor(log: Logger) {
    super(log, TICK_MS);
  }

  protected executeTick(): Promise<void> {
    this.executeTickCalls++;
    return Promise.resolve();
  }
}

class FailingService extends IntervalService {
  constructor(log: Logger) {
    super(log, TICK_MS);
  }

  protected executeTick(): Promise<void> {
    return Promise.reject(TICK_ERROR);
  }
}

class GatedService extends IntervalService {
  private readonly gate: Promise<void>;
  private release: (() => void) | null = null;

  constructor(log: Logger) {
    super(log, TICK_MS);
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

describe('IntervalService', () => {
  it('calls onStart, fires an initial tick, sets an interval, and stops cleanly via onStop', async () => {
    const log = createMockLogger();
    const svc = new StubService(log);

    const { stop } = await svc.start();
    expect(svc.executeTickCalls).toBeGreaterThanOrEqual(1);

    await stop();
    expect(svc['stopped']).toBe(true);
  });

  it('tickGuard returns false when stopped', async () => {
    const log = createMockLogger();
    const svc = new StubService(log);
    await svc.start();
    await svc['stop']();
    expect(svc['tickGuard']()).toBe(false);
  });

  it('tickGuard returns false when a tick is in flight', () => {
    const log = createMockLogger();
    const svc = new StubService(log);
    (svc as any).tickPromise = Promise.resolve();
    expect(svc['tickGuard']()).toBe(false);
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
});
