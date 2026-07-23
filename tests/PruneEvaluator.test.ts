import type { PRStateFetcher } from '../src/github/index.js';
import { PruneEvaluatorImpl } from '../src/services.js';

import { generateQueueItemHydrationData, generateReviewRef } from './helpers/index.js';

import { getUniqueDate } from '@couimet/dynamic-testing';
import { createMockLogger } from '@couimet/logger-contract-testing';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

describe('PruneEvaluator', () => {
  let fetcher: PRStateFetcher;
  let logger: ReturnType<typeof createMockLogger>;

  beforeEach(() => {
    fetcher = {
      fetch: jest.fn<any>(),
    } as unknown as PRStateFetcher;

    logger = createMockLogger();
  });

  const createEvaluator = () => new PruneEvaluatorImpl(fetcher, logger);

  describe('evaluate', () => {
    it('returns merged outcome for merged PRs', async () => {
      const ref = generateReviewRef();
      const item = generateQueueItemHydrationData({ repo_full_name: ref.repoFullName, pr_number: ref.prNumber });
      (fetcher.fetch as jest.Mock<any>).mockResolvedValue({ state: 'closed', merged_at: getUniqueDate().toISOString() });

      const evaluator = createEvaluator();
      const result = await evaluator.evaluate([item]);

      expect(result).toStrictEqual([{ item, outcome: 'merged' }]);
    });

    it('returns closed outcome for closed-without-merge PRs', async () => {
      const ref = generateReviewRef();
      const item = generateQueueItemHydrationData({ repo_full_name: ref.repoFullName, pr_number: ref.prNumber });
      (fetcher.fetch as jest.Mock<any>).mockResolvedValue({ state: 'closed', merged_at: null });

      const evaluator = createEvaluator();
      const result = await evaluator.evaluate([item]);

      expect(result).toStrictEqual([{ item, outcome: 'closed-without-merge' }]);
    });

    it('skips open PRs', async () => {
      const ref = generateReviewRef();
      const item = generateQueueItemHydrationData({ repo_full_name: ref.repoFullName, pr_number: ref.prNumber });
      (fetcher.fetch as jest.Mock<any>).mockResolvedValue({ state: 'open', merged_at: null });

      const evaluator = createEvaluator();
      const result = await evaluator.evaluate([item]);

      expect(result).toStrictEqual([]);
      expect(logger.debug).toHaveBeenCalledWith(
        { fn: 'PruneEvaluator.evaluate', repo: ref.repoFullName, pr: ref.prNumber, queueId: item.id },
        'PR still open; skipping',
      );
    });

    it('skips items where fetch returns undefined', async () => {
      const ref = generateReviewRef();
      const item = generateQueueItemHydrationData({ repo_full_name: ref.repoFullName, pr_number: ref.prNumber });
      (fetcher.fetch as jest.Mock<any>).mockResolvedValue(undefined);

      const evaluator = createEvaluator();
      const result = await evaluator.evaluate([item]);

      expect(result).toStrictEqual([]);
    });

    it('handles an empty input array', async () => {
      const evaluator = createEvaluator();
      const result = await evaluator.evaluate([]);

      expect(result).toStrictEqual([]);
      expect(fetcher.fetch).not.toHaveBeenCalled();
    });

    it('evaluates multiple items concurrently', async () => {
      const ref1 = generateReviewRef();
      const ref2 = generateReviewRef();
      const ref3 = generateReviewRef();
      const item1 = generateQueueItemHydrationData({ repo_full_name: ref1.repoFullName, pr_number: ref1.prNumber });
      const item2 = generateQueueItemHydrationData({ repo_full_name: ref2.repoFullName, pr_number: ref2.prNumber });
      const item3 = generateQueueItemHydrationData({ repo_full_name: ref3.repoFullName, pr_number: ref3.prNumber });

      (fetcher.fetch as jest.Mock<any>)
        .mockResolvedValueOnce({ state: 'closed', merged_at: getUniqueDate().toISOString() })
        .mockResolvedValueOnce({ state: 'closed', merged_at: null })
        .mockResolvedValueOnce({ state: 'open', merged_at: null });

      const evaluator = createEvaluator();
      const result = await evaluator.evaluate([item1, item2, item3]);

      expect(result).toStrictEqual([
        { item: item1, outcome: 'merged' },
        { item: item2, outcome: 'closed-without-merge' },
      ]);
      expect(logger.debug).toHaveBeenCalledWith(
        { fn: 'PruneEvaluator.evaluate', repo: ref3.repoFullName, pr: ref3.prNumber, queueId: item3.id },
        'PR still open; skipping',
      );
    });
  });
});
