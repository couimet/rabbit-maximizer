import type { QueueRepository } from '../src/db/index.js';
import { ExclusionSweeper, IgnoreRules } from '../src/services.js';
import type { QueueItem } from '../src/types/index.js';

import {
  createMockExclusionSweeperProbe,
  createMockProbeFactory,
  createMockPullRequestRepo,
  createMockQueueRepo,
  generateConfigData,
  generateQueueItemHydrationData,
  generateReviewRef,
} from './helpers/index.js';

import { getUniqueInt, getUniqueString } from '@couimet/dynamic-testing';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const AUTHOR_RULE = 'renovate';
const TITLE_RULE = '^chore\\(';

interface SweeperFixture {
  readonly queue: jest.Mocked<QueueRepository>;
  readonly pullRequests: ReturnType<typeof createMockPullRequestRepo>;
  readonly probe: ReturnType<typeof createMockExclusionSweeperProbe>;
}

const buildSweeper = (ignoreAuthors: readonly string[], ignoreTitles: readonly string[]): SweeperFixture & { readonly sweeper: ExclusionSweeper } => {
  const queue = createMockQueueRepo();
  const pullRequests = createMockPullRequestRepo();
  const probe = createMockExclusionSweeperProbe();
  const probes = createMockProbeFactory({ createExclusionSweeperProbe: jest.fn(() => probe) });
  const ignoreRules = new IgnoreRules(generateConfigData({ IGNORE_AUTHORS: [...ignoreAuthors], IGNORE_TITLES: [...ignoreTitles] }));
  return { queue, pullRequests, probe, sweeper: new ExclusionSweeper(queue, pullRequests, probes, ignoreRules) };
};

const columnMaps = (authorLogins: Array<[number, string]>, titles: Array<[number, string]>) => ({
  author_login: new Map(authorLogins),
  title: new Map(titles),
});

const buildItem = (pullRequestId: number): QueueItem => {
  const ref = generateReviewRef();
  return generateQueueItemHydrationData({
    repo_full_name: ref.repoFullName,
    pr_number: ref.prNumber,
    source_comment_id: ref.commentId,
    pull_request_id: pullRequestId,
  });
};

describe('ExclusionSweeper', () => {
  let fixture: SweeperFixture & { readonly sweeper: ExclusionSweeper };

  beforeEach(() => {
    fixture = buildSweeper([AUTHOR_RULE], [TITLE_RULE]);
  });

  describe('sweep', () => {
    it('returns 0 without reading the queue when no rule is configured', async () => {
      const noRules = buildSweeper([], []);

      const result = await noRules.sweeper.sweep();

      expect(result).toBe(0);
      expect(noRules.queue.getActiveQueue).not.toHaveBeenCalled();
      expect(noRules.probe.sweepStarted).not.toHaveBeenCalled();
    });

    it('returns 0 and does not start the probe when the active queue is empty', async () => {
      fixture.queue.getActiveQueue.mockResolvedValue([]);

      const result = await fixture.sweeper.sweep();

      expect(result).toBe(0);
      expect(fixture.probe.sweepStarted).not.toHaveBeenCalled();
      expect(fixture.pullRequests.getColumnMaps).not.toHaveBeenCalled();
      expect(fixture.probe.completed).not.toHaveBeenCalled();
    });

    it('resolves an item whose author login matches a rule', async () => {
      const pullRequestId = getUniqueInt();
      const item = buildItem(pullRequestId);
      fixture.queue.getActiveQueue.mockResolvedValue([item]);
      fixture.pullRequests.getColumnMaps.mockResolvedValue(columnMaps([[pullRequestId, 'renovate-bot']], [[pullRequestId, 'Bump lodash']]));

      const result = await fixture.sweeper.sweep();

      expect(result).toBe(1);
      expect(fixture.probe.sweepStarted).toHaveBeenCalledWith(1);
      expect(fixture.queue.markResolvedByPullRequestId).toHaveBeenCalledWith(pullRequestId, 'excluded', undefined);
      expect(fixture.probe.completed).toHaveBeenCalledWith(1, 1);
      expect(fixture.probe.itemFailed).not.toHaveBeenCalled();
    });

    it('resolves an item whose title matches a rule', async () => {
      const pullRequestId = getUniqueInt();
      const item = buildItem(pullRequestId);
      fixture.queue.getActiveQueue.mockResolvedValue([item]);
      fixture.pullRequests.getColumnMaps.mockResolvedValue(columnMaps([[pullRequestId, getUniqueString()]], [[pullRequestId, 'chore(deps): bump lodash']]));

      const result = await fixture.sweeper.sweep();

      expect(result).toBe(1);
      expect(fixture.queue.markResolvedByPullRequestId).toHaveBeenCalledWith(pullRequestId, 'excluded', undefined);
      expect(fixture.probe.completed).toHaveBeenCalledWith(1, 1);
    });

    it('leaves an item in place when no rule matches', async () => {
      const pullRequestId = getUniqueInt();
      const item = buildItem(pullRequestId);
      fixture.queue.getActiveQueue.mockResolvedValue([item]);
      fixture.pullRequests.getColumnMaps.mockResolvedValue(columnMaps([[pullRequestId, getUniqueString()]], [[pullRequestId, getUniqueString()]]));

      const result = await fixture.sweeper.sweep();

      expect(result).toBe(0);
      expect(fixture.queue.markResolvedByPullRequestId).not.toHaveBeenCalled();
      expect(fixture.probe.completed).toHaveBeenCalledWith(1, 0);
    });

    it('skips an item whose pull request holds no matching column map entry', async () => {
      const knownId = getUniqueInt();
      const unknownId = getUniqueInt();
      fixture.queue.getActiveQueue.mockResolvedValue([buildItem(knownId), buildItem(unknownId)]);
      fixture.pullRequests.getColumnMaps.mockResolvedValue(columnMaps([[knownId, 'renovate-bot']], [[knownId, 'Bump lodash']]));

      const result = await fixture.sweeper.sweep();

      expect(result).toBe(1);
      expect(fixture.queue.markResolvedByPullRequestId).toHaveBeenCalledTimes(1);
      expect(fixture.queue.markResolvedByPullRequestId).toHaveBeenCalledWith(knownId, 'excluded', undefined);
      expect(fixture.probe.completed).toHaveBeenCalledWith(2, 1);
    });

    it('skips an item whose title column map entry is missing', async () => {
      const pullRequestId = getUniqueInt();
      const item = buildItem(pullRequestId);
      fixture.queue.getActiveQueue.mockResolvedValue([item]);
      fixture.pullRequests.getColumnMaps.mockResolvedValue(columnMaps([[pullRequestId, 'renovate-bot']], []));

      const result = await fixture.sweeper.sweep();

      expect(result).toBe(0);
      expect(fixture.queue.markResolvedByPullRequestId).not.toHaveBeenCalled();
      expect(fixture.probe.completed).toHaveBeenCalledWith(1, 0);
    });

    it('reports a failed resolution and continues with the remaining items', async () => {
      const failingId = getUniqueInt();
      const nextId = getUniqueInt();
      const failingItem = buildItem(failingId);
      const error = new Error('database is locked');
      fixture.queue.getActiveQueue.mockResolvedValue([failingItem, buildItem(nextId)]);
      fixture.pullRequests.getColumnMaps.mockResolvedValue(
        columnMaps(
          [
            [failingId, 'renovate-bot'],
            [nextId, 'renovate-bot'],
          ],
          [
            [failingId, 'Bump lodash'],
            [nextId, 'Bump eslint'],
          ],
        ),
      );
      fixture.queue.markResolvedByPullRequestId.mockRejectedValueOnce(error).mockResolvedValueOnce(1);

      const result = await fixture.sweeper.sweep();

      expect(result).toBe(1);
      expect(fixture.probe.itemFailed).toHaveBeenCalledWith(failingItem.repo_full_name, failingItem.pr_number, failingId, error);
      expect(fixture.queue.markResolvedByPullRequestId).toHaveBeenCalledTimes(2);
      expect(fixture.probe.completed).toHaveBeenCalledWith(2, 1);
    });

    it('does not count an item when the resolution changes no row', async () => {
      const pullRequestId = getUniqueInt();
      const item = buildItem(pullRequestId);
      fixture.queue.getActiveQueue.mockResolvedValue([item]);
      fixture.pullRequests.getColumnMaps.mockResolvedValue(columnMaps([[pullRequestId, 'renovate-bot']], [[pullRequestId, 'Bump lodash']]));
      fixture.queue.markResolvedByPullRequestId.mockResolvedValue(0);

      const result = await fixture.sweeper.sweep();

      expect(result).toBe(0);
      expect(fixture.probe.completed).toHaveBeenCalledWith(1, 0);
      expect(fixture.probe.itemFailed).not.toHaveBeenCalled();
    });

    it('reads one column map entry per distinct pull request', async () => {
      const sharedId = getUniqueInt();
      fixture.queue.getActiveQueue.mockResolvedValue([buildItem(sharedId), buildItem(sharedId)]);
      fixture.pullRequests.getColumnMaps.mockResolvedValue(columnMaps([[sharedId, 'renovate-bot']], [[sharedId, 'Bump lodash']]));

      await fixture.sweeper.sweep();

      expect(fixture.pullRequests.getColumnMaps).toHaveBeenCalledWith([sharedId], ['author_login', 'title']);
    });
  });
});
