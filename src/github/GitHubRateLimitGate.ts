import { type SystemStateRepository } from '../db/index.js';
import { TYPES } from '../server-domain.js';
import { MS_PER_SECOND, secondaryLimitWaitSec } from '../utils/index.js';

import { parseGitHubRateLimitError } from './parseGitHubRateLimitError.js';

import type { Logger } from '@couimet/logger-contract';
import { inject, injectable } from 'inversify';

/**
 * The one GitHub rate-limit window that every service shares.
 *
 * GitHub applies its quota to the account, not to one service, so a window that
 * one service opens must hold every service. The instant lives in `system_state`
 * so a restart keeps the window that the previous run recorded.
 *
 * The read path is synchronous because `IntervalService.tickGuard()` is
 * synchronous. `initialize()` loads the persisted instant once at startup.
 */
@injectable()
export class GitHubRateLimitGate {
  private blockedUntil = 0;

  /* c8 ignore start — decorator emit branches */
  constructor(
    @inject(TYPES.SystemStateRepository)
    private readonly systemState: SystemStateRepository,
    @inject(TYPES.Logger)
    private readonly log: Logger,
  ) {}
  /* c8 ignore stop */

  isBlocked(): boolean {
    return Date.now() < this.blockedUntil;
  }

  /**
   * Reports the remaining wait while the window holds, or undefined when the
   * gate is open.
   */
  retryAfterMs(): number | undefined {
    const remaining = this.blockedUntil - Date.now();
    return remaining > 0 ? remaining : undefined;
  }

  /**
   * Records a GitHub error. Reports true when the error reports a rate limit, so
   * the caller stops its work; the gate then holds every service until the
   * window ends. Reports false for any other error.
   *
   * The gate keeps only a later instant: a shorter wait from a second error must
   * not reopen the window early.
   */
  async recordError(err: unknown): Promise<boolean> {
    const rateLimit = parseGitHubRateLimitError(err);
    if (!rateLimit) {
      return false;
    }

    const waitMs =
      rateLimit.kind === 'quota-exhausted'
        ? Math.max(0, rateLimit.resetEpoch * MS_PER_SECOND - Date.now())
        : secondaryLimitWaitSec(rateLimit.retryAfterSec) * MS_PER_SECOND;
    const until = Date.now() + waitMs;

    if (until <= this.blockedUntil) {
      return true;
    }

    this.blockedUntil = until;
    this.log.warn(
      {
        fn: 'GitHubRateLimitGate.recordError',
        kind: rateLimit.kind,
        status: rateLimit.status,
        retryAfterSec: Math.ceil(waitMs / MS_PER_SECOND),
        blockedUntil: new Date(until),
        resetEpoch: rateLimit.kind === 'quota-exhausted' ? rateLimit.resetEpoch : undefined,
        resource: rateLimit.resource,
        limit: rateLimit.limit,
        remaining: rateLimit.remaining,
        used: rateLimit.used,
        error: err,
      },
      'GitHub API rate limit exhausted; all services back off until reset',
    );

    await this.persist(until);
    return true;
  }

  /**
   * Restores the window that a previous run recorded. A failed read leaves the
   * gate open: a missing guard must not stop the application from starting.
   */
  async initialize(): Promise<void> {
    try {
      const stored = await this.systemState.getGitHubRateLimitResetAt(undefined);
      if (stored !== undefined && stored.getTime() > Date.now()) {
        this.blockedUntil = stored.getTime();
        this.log.info({ fn: 'GitHubRateLimitGate.initialize', blockedUntil: stored }, 'Restored the GitHub rate-limit window from the previous run');
      }
    } catch (err: unknown) {
      this.log.warn({ fn: 'GitHubRateLimitGate.initialize', error: err }, 'Failed to read the stored rate-limit window; starting unblocked');
    }
  }

  private async persist(until: number): Promise<void> {
    try {
      await this.systemState.setGitHubRateLimitResetAt(new Date(until), undefined);
    } catch (err: unknown) {
      this.log.warn({ fn: 'GitHubRateLimitGate.persist', error: err }, 'Failed to persist the rate-limit window; the in-memory window still holds');
    }
  }
}
