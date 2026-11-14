import { GitHubRateLimitGate } from '../../src/github/index.js';
import { MS_PER_SECOND } from '../../src/utils/index.js';
import { createMockSystemStateRepository } from '../helpers/index.js';

import { createMockLogger } from '@couimet/logger-contract-testing';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const NOW_MS = 1_700_000_000_000;
const NOW_EPOCH_SEC = NOW_MS / MS_PER_SECOND;
const QUOTA_WAIT_SEC = 900;
const THROTTLED_WAIT_SEC = 120;
const SECONDARY_LIMIT_FALLBACK_WAIT_SEC = 60;

const createQuotaError = (resetEpoch: number) => ({
  status: 403,
  response: {
    headers: {
      'x-ratelimit-limit': '5000',
      'x-ratelimit-remaining': '0',
      'x-ratelimit-used': '5000',
      'x-ratelimit-reset': String(resetEpoch),
      'x-ratelimit-resource': 'core',
    },
  },
});

const createThrottledError = (retryAfterSec: number | undefined) => ({
  status: 429,
  response: { headers: retryAfterSec === undefined ? {} : { 'retry-after': String(retryAfterSec) } },
});

describe('GitHubRateLimitGate', () => {
  let systemState: ReturnType<typeof createMockSystemStateRepository>;
  let logger: ReturnType<typeof createMockLogger>;

  beforeEach(() => {
    systemState = createMockSystemStateRepository();
    logger = createMockLogger();
    jest.spyOn(Date, 'now').mockReturnValue(NOW_MS);
  });

  const createGate = () => new GitHubRateLimitGate(systemState, logger);

  describe('recordError', () => {
    it('holds every service until the exhausted quota resets', async () => {
      const error = createQuotaError(NOW_EPOCH_SEC + QUOTA_WAIT_SEC);
      const gate = createGate();

      const recorded = await gate.recordError(error);

      expect(recorded).toBe(true);
      expect(gate.isBlocked()).toBe(true);
      expect(gate.retryAfterMs()).toBe(QUOTA_WAIT_SEC * MS_PER_SECOND);
      expect(logger.warn).toHaveBeenCalledWith(
        {
          fn: 'GitHubRateLimitGate.recordError',
          kind: 'quota-exhausted',
          status: 403,
          retryAfterSec: QUOTA_WAIT_SEC,
          blockedUntil: new Date(NOW_MS + QUOTA_WAIT_SEC * MS_PER_SECOND),
          resetEpoch: NOW_EPOCH_SEC + QUOTA_WAIT_SEC,
          resource: 'core',
          limit: 5000,
          remaining: 0,
          used: 5000,
          error,
        },
        'GitHub API rate limit exhausted; all services back off until reset',
      );
      expect(systemState.setGitHubRateLimitResetAt).toHaveBeenCalledWith(new Date(NOW_MS + QUOTA_WAIT_SEC * MS_PER_SECOND), undefined);
    });

    it('holds every service for the retry-after wait when GitHub throttles a request', async () => {
      const error = createThrottledError(THROTTLED_WAIT_SEC);
      const gate = createGate();

      const recorded = await gate.recordError(error);

      expect(recorded).toBe(true);
      expect(gate.retryAfterMs()).toBe(THROTTLED_WAIT_SEC * MS_PER_SECOND);
      expect(logger.warn).toHaveBeenCalledWith(
        {
          fn: 'GitHubRateLimitGate.recordError',
          kind: 'throttled',
          status: 429,
          retryAfterSec: THROTTLED_WAIT_SEC,
          blockedUntil: new Date(NOW_MS + THROTTLED_WAIT_SEC * MS_PER_SECOND),
          resetEpoch: undefined,
          resource: undefined,
          limit: undefined,
          remaining: undefined,
          used: undefined,
          error,
        },
        'GitHub API rate limit exhausted; all services back off until reset',
      );
    });

    it('falls back to the documented minimum wait when the throttled response names none', async () => {
      const gate = createGate();

      const recorded = await gate.recordError(createThrottledError(undefined));

      expect(recorded).toBe(true);
      expect(gate.retryAfterMs()).toBe(SECONDARY_LIMIT_FALLBACK_WAIT_SEC * MS_PER_SECOND);
      expect(systemState.setGitHubRateLimitResetAt).toHaveBeenCalledWith(new Date(NOW_MS + SECONDARY_LIMIT_FALLBACK_WAIT_SEC * MS_PER_SECOND), undefined);
    });

    it('reports false and keeps the gate open for an error that is not a rate limit', async () => {
      const gate = createGate();

      const recorded = await gate.recordError({ status: 500 });

      expect(recorded).toBe(false);
      expect(gate.isBlocked()).toBe(false);
      expect(gate.retryAfterMs()).toBeUndefined();
      expect(logger.warn).not.toHaveBeenCalled();
      expect(systemState.setGitHubRateLimitResetAt).not.toHaveBeenCalled();
    });

    it('keeps the later instant when a shorter window arrives', async () => {
      const gate = createGate();

      await gate.recordError(createQuotaError(NOW_EPOCH_SEC + QUOTA_WAIT_SEC));
      const recorded = await gate.recordError(createThrottledError(THROTTLED_WAIT_SEC));

      expect(recorded).toBe(true);
      expect(gate.retryAfterMs()).toBe(QUOTA_WAIT_SEC * MS_PER_SECOND);
      expect(logger.warn).toHaveBeenCalledTimes(1);
      expect(systemState.setGitHubRateLimitResetAt).toHaveBeenCalledTimes(1);
    });

    it('keeps the in-memory window when the persist fails', async () => {
      const persistError = new Error('database is locked');
      systemState.setGitHubRateLimitResetAt.mockRejectedValue(persistError);
      const gate = createGate();

      const recorded = await gate.recordError(createThrottledError(THROTTLED_WAIT_SEC));

      expect(recorded).toBe(true);
      expect(gate.isBlocked()).toBe(true);
      expect(logger.warn).toHaveBeenNthCalledWith(
        2,
        { fn: 'GitHubRateLimitGate.persist', error: persistError },
        'Failed to persist the rate-limit window; the in-memory window still holds',
      );
    });
  });

  describe('initialize', () => {
    it('restores a stored window that has not ended', async () => {
      const stored = new Date(NOW_MS + QUOTA_WAIT_SEC * MS_PER_SECOND);
      systemState.getGitHubRateLimitResetAt.mockResolvedValue(stored);
      const gate = createGate();

      await gate.initialize();

      expect(systemState.getGitHubRateLimitResetAt).toHaveBeenCalledWith(undefined);
      expect(gate.isBlocked()).toBe(true);
      expect(gate.retryAfterMs()).toBe(QUOTA_WAIT_SEC * MS_PER_SECOND);
      expect(logger.info).toHaveBeenCalledWith(
        { fn: 'GitHubRateLimitGate.initialize', blockedUntil: stored },
        'Restored the GitHub rate-limit window from the previous run',
      );
    });

    it('stays open when the stored window has ended', async () => {
      systemState.getGitHubRateLimitResetAt.mockResolvedValue(new Date(NOW_MS - QUOTA_WAIT_SEC * MS_PER_SECOND));
      const gate = createGate();

      await gate.initialize();

      expect(gate.isBlocked()).toBe(false);
      expect(logger.info).not.toHaveBeenCalled();
    });

    it('stays open when no window is stored', async () => {
      systemState.getGitHubRateLimitResetAt.mockResolvedValue(undefined);
      const gate = createGate();

      await gate.initialize();

      expect(gate.isBlocked()).toBe(false);
      expect(logger.warn).not.toHaveBeenCalled();
      expect(logger.info).not.toHaveBeenCalled();
    });

    it('stays open and warns when the stored window cannot be read', async () => {
      const readError = new Error('database is locked');
      systemState.getGitHubRateLimitResetAt.mockRejectedValue(readError);
      const gate = createGate();

      await gate.initialize();

      expect(gate.isBlocked()).toBe(false);
      expect(logger.warn).toHaveBeenCalledWith(
        { fn: 'GitHubRateLimitGate.initialize', error: readError },
        'Failed to read the stored rate-limit window; starting unblocked',
      );
    });
  });
});
