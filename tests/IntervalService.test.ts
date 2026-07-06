import { IntervalService } from '../src/IntervalService.js';

import { createMockLogger } from './helpers/index.js';

import type { Logger } from '@couimet/logger-contract';
import { describe, expect, it } from '@jest/globals';

const TICK_MS = 100;

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

describe('IntervalService', () => {
  it('calls onStart, fires an initial tick, sets an interval, and stops cleanly via onStop', async () => {
    const log = createMockLogger();
    const svc = new StubService(log);

    const { stop } = svc.start();
    expect(svc.executeTickCalls).toBeGreaterThanOrEqual(1);

    await stop();
    expect(svc['stopped']).toBe(true);
  });

  it('tickGuard returns false when stopped', async () => {
    const log = createMockLogger();
    const svc = new StubService(log);
    svc.start();
    await svc['stop']();
    expect(svc['tickGuard']()).toBe(false);
  });

  it('tickGuard returns false when a tick is in flight', () => {
    const log = createMockLogger();
    const svc = new StubService(log);
    (svc as any).tickPromise = Promise.resolve();
    expect(svc['tickGuard']()).toBe(false);
  });
});
