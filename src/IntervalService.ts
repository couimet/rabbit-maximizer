import type { TickGuardOutcome } from './types/index.js';
import { MS_PER_SECOND } from './utils/index.js';
import { TickGuardReason } from './TickGuardReason.js';

import { ExecutionContext, RequestId } from '@couimet/execution-context';
import type { Logger } from '@couimet/logger-contract';

type BlockedTickGuardOutcome = Extract<TickGuardOutcome, { readonly allowed: false }>;

/**
 * Shared lifecycle for components that run on a fixed interval: start,
 * tick, stop, and concurrency gating. Subclasses implement {@link executeTick}
 * and may override {@link tickGuard} for additional pre-tick conditions.
 */
export abstract class IntervalService {
  private intervalId: ReturnType<typeof setInterval> | undefined;
  private tickPromise: Promise<void> | null = null;
  private suppressedSince = 0;
  private suppressedTickCount = 0;
  private lastSuppression: BlockedTickGuardOutcome | undefined;
  private lastTickStartedAt: number | undefined;
  protected stopped = false;

  constructor(
    private readonly correlationId: string,
    protected readonly intervalMs: number,
    protected readonly log: Logger,
  ) {}

  protected abstract executeTick(): Promise<void>;

  protected tickGuard(): TickGuardOutcome {
    if (this.stopped) {
      return { allowed: false, reason: TickGuardReason.stopped, retryAfterMs: undefined };
    }
    if (this.tickPromise !== null) {
      return { allowed: false, reason: TickGuardReason.tickInFlight, retryAfterMs: undefined };
    }
    return { allowed: true };
  }

  async start(): Promise<{ stop(): Promise<void> }> {
    this.onStart();
    await this.bootstrapTick();
    this.intervalId = setInterval(() => {
      this.tick();
    }, this.intervalMs);
    return { stop: () => this.stop() };
  }

  /** Subclass hook for start-logging. Called before the first tick. */
  protected onStart(): void {}

  private async stop(): Promise<void> {
    this.stopped = true;
    if (this.intervalId !== undefined) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }
    if (this.tickPromise) {
      await this.tickPromise;
    }
    this.onStop();
  }

  /** Subclass hook for stop-logging. Called after the last tick settles. */
  protected onStop(): void {}

  private async tick(): Promise<void> {
    const now = Date.now();
    this.logTickGap(now);
    this.lastTickStartedAt = now;

    const outcome = this.tickGuard();
    if (!outcome.allowed) {
      this.recordSuppression(outcome);
      return;
    }
    this.logResumptionIfSuppressed(now);

    this.tickPromise = ExecutionContext.run(
      {
        correlationId: this.correlationId,
        requestId: RequestId.create().toString(),
        attributes: { ...ExecutionContext.getAttributes() },
      },
      () => this.executeTick(),
    );
    try {
      await this.tickPromise;
    } catch (err) {
      this.log.warn({ fn: 'IntervalService.tick', error: err }, 'executeTick threw; continuing');
    } finally {
      this.tickPromise = null;
    }
  }

  /**
   * Compares the wall clock against the expected tick time. The host can sleep
   * for hours, and the timer then fires late with no other trace of the gap.
   */
  private logTickGap(now: number): void {
    if (this.lastTickStartedAt === undefined) {
      return;
    }
    const gapMs = now - (this.lastTickStartedAt + this.intervalMs);
    if (gapMs > this.intervalMs) {
      this.log.warn({ fn: 'IntervalService.tick', gapMs }, 'Interval tick ran late; the wall clock passed the expected tick time');
    }
  }

  private recordSuppression(outcome: BlockedTickGuardOutcome): void {
    if (this.suppressedTickCount === 0) {
      this.suppressedSince = Date.now();
    }
    this.suppressedTickCount += 1;
    this.lastSuppression = outcome;

    // A bitwise and of n with n - 1 is zero only at powers of two, so the line
    // thins to 1, 2, 4, 8... and a long window shows the count without one line per interval.
    const isLogPoint = (this.suppressedTickCount & (this.suppressedTickCount - 1)) === 0;
    if (!isLogPoint) {
      return;
    }

    this.log.warn(
      {
        fn: 'IntervalService.tick',
        guard: outcome.reason,
        retryAfterSec: outcome.retryAfterMs === undefined ? undefined : Math.ceil(outcome.retryAfterMs / MS_PER_SECOND),
        suppressedTickCount: this.suppressedTickCount,
      },
      'Interval tick suppressed',
    );
  }

  private logResumptionIfSuppressed(now: number): void {
    if (this.suppressedTickCount === 0) {
      return;
    }

    const guard = this.lastSuppression?.reason;
    const suppressedTickCount = this.suppressedTickCount;
    const suppressedSince = this.suppressedSince;
    this.suppressedTickCount = 0;
    this.suppressedSince = 0;
    this.lastSuppression = undefined;

    this.log.info({ fn: 'IntervalService.tick', guard, suppressedTickCount, suppressedMs: now - suppressedSince }, 'Interval tick resumed after suppression');
  }

  /**
   * Runs the initial tick and awaits its completion so start() only returns
   * after the first tick has settled. If a tick is already in flight, awaits
   * it instead of starting a second concurrent one.
   */
  async bootstrapTick(): Promise<void> {
    if (this.tickPromise) {
      await this.tickPromise;
    } else {
      await this.tick();
    }
  }
}
