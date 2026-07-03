import type { PRStateFetcher } from '../src/github/PRStateFetcher.js';
import { PruneEvaluatorImpl } from '../src/PruneEvaluator.js';
import type { QueueItem } from '../src/types/index.js';

import { createMockLogger, makeUniqueRepoName } from './helpers/index.js';

import { getUniqueInt } from '@couimet/dynamic-testing';
import type { Logger } from '@couimet/logger-contract';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const makeItem = (repo: string, pr: number): QueueItem => ({ id: getUniqueInt(), repo_full_name: repo, pr_number: pr }) as unknown as QueueItem;

describe('PruneEvaluator', () => {
  let fetcher: PRStateFetcher;
  let logger: Logger;

  beforeEach(() => {
    fetcher = {
      fetch: jest.fn<any>(),
    } as unknown as PRStateFetcher;

    logger = createMockLogger();
  });

  const createEvaluator = () => new PruneEvaluatorImpl(fetcher, logger);

  describe('evaluate', () => {
    it('returns merged outcome for merged PRs', async () => {
      const { fullName: repo } = makeUniqueRepoName();
      const pr = getUniqueInt();
      const item = makeItem(repo, pr);
      (fetcher.fetch as jest.Mock<any>).mockResolvedValue({ state: 'closed', merged_at: '2026-01-01T00:00:00Z' });

      const evaluator = createEvaluator();
      const result = await evaluator.evaluate([item]);

      expect(result).toStrictEqual([{ item, outcome: 'merged' }]);
    });

    it('returns closed outcome for closed-without-merge PRs', async () => {
      const { fullName: repo } = makeUniqueRepoName();
      const pr = getUniqueInt();
      const item = makeItem(repo, pr);
      (fetcher.fetch as jest.Mock<any>).mockResolvedValue({ state: 'closed', merged_at: null });

      const evaluator = createEvaluator();
      const result = await evaluator.evaluate([item]);

      expect(result).toStrictEqual([{ item, outcome: 'closed-without-merge' }]);
    });

    it('skips open PRs', async () => {
      const { fullName: repo } = makeUniqueRepoName();
      const pr = getUniqueInt();
      const item = makeItem(repo, pr);
      (fetcher.fetch as jest.Mock<any>).mockResolvedValue({ state: 'open', merged_at: null });

      const evaluator = createEvaluator();
      const result = await evaluator.evaluate([item]);

      expect(result).toStrictEqual([]);
      expect(logger.debug as jest.Mock<any>).toHaveBeenCalledWith({ fn: 'PruneEvaluator.evaluate', repo, pr, queueId: item.id }, 'PR still open; skipping');
    });

    it('skips items where fetch returns undefined', async () => {
      const { fullName: repo } = makeUniqueRepoName();
      const pr = getUniqueInt();
      const item = makeItem(repo, pr);
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
      const { fullName: repo1 } = makeUniqueRepoName();
      const { fullName: repo2 } = makeUniqueRepoName();
      const { fullName: repo3 } = makeUniqueRepoName();
      const pr1 = getUniqueInt();
      const pr2 = getUniqueInt();
      const pr3 = getUniqueInt();

      const item1 = makeItem(repo1, pr1);
      const item2 = makeItem(repo2, pr2);
      const item3 = makeItem(repo3, pr3);

      (fetcher.fetch as jest.Mock<any>)
        .mockResolvedValueOnce({ state: 'closed', merged_at: '2026-01-01T00:00:00Z' }) // merged
        .mockResolvedValueOnce({ state: 'closed', merged_at: null }) // closed without merge
        .mockResolvedValueOnce({ state: 'open', merged_at: null }); // open → skipped

      const evaluator = createEvaluator();
      const result = await evaluator.evaluate([item1, item2, item3]);

      expect(result).toStrictEqual([
        { item: item1, outcome: 'merged' },
        { item: item2, outcome: 'closed-without-merge' },
      ]);
      expect(logger.debug as jest.Mock<any>).toHaveBeenCalledWith(
        { fn: 'PruneEvaluator.evaluate', repo: repo3, pr: pr3, queueId: item3.id },
        'PR still open; skipping',
      );
    });
  });
});
