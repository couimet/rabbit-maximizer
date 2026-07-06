import type { Logger } from '@couimet/logger-contract';

/**
 * Shared lifecycle for components that run on a fixed interval: start,
 * tick, stop, and concurrency gating. Subclasses implement {@link executeTick}
 * and may override {@link tickGuard} for additional pre-tick conditions.
 */
export abstract class IntervalService {
  private intervalId: ReturnType<typeof setInterval> | undefined;
  private tickPromise: Promise<void> | null = null;
  protected stopped = false;

  constructor(
    protected readonly log: Logger,
    protected readonly intervalMs: number,
  ) {}

  protected abstract executeTick(): Promise<void>;

  protected tickGuard(): boolean {
    return !this.stopped && this.tickPromise === null;
  }

  start(): { stop(): Promise<void> } {
    this.onStart();
    this.tick();
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
    if (!this.tickGuard()) return;
    this.tickPromise = this.executeTick();
    try {
      await this.tickPromise;
    } finally {
      this.tickPromise = null;
    }
  }
}
