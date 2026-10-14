import { config } from '../src/config.js';
import type { QueueRepository } from '../src/db/index.js';
import type { CoderabbitGitHubClient } from '../src/github/index.js';
import { RefusalSweeper } from '../src/services.js';
import type { OnDetectedCallback, QueueItem } from '../src/types/index.js';

import {
  createCoderabbitCommentClassifier,
  createMockCoderabbitGitHubClient,
  createMockOnDetectedCallback,
  createMockProbeFactory,
  createMockQueueRepo,
  generateQueueItemHydrationData,
  generateReviewRef,
} from './helpers/index.js';

import { getUniqueDate, getUniqueString } from '@couimet/dynamic-testing';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

interface MockRefusalSweeperProbe {
  sweepStarted: jest.Mock<any>;
  itemFailed: jest.Mock<any>;
  completed: jest.Mock<any>;
}

const createMockRefusalSweeperProbe = (): MockRefusalSweeperProbe => ({
  sweepStarted: jest.fn<any>(),
  itemFailed: jest.fn<any>(),
  completed: jest.fn<any>(),
});

const buildItem = (ref: ReturnType<typeof generateReviewRef>): QueueItem =>
  generateQueueItemHydrationData({
    repo_full_name: ref.repoFullName,
    pr_number: ref.prNumber,
    source_comment_id: ref.commentId,
  });

const refusalBody = (): string => `This PR was authored by a bot ${config.CODERABBIT_REFUSAL_PHRASES[0]}.`;

describe('RefusalSweeper', () => {
  let queue: jest.Mocked<QueueRepository>;
  let github: jest.Mocked<CoderabbitGitHubClient>;
  let onDetected: jest.Mocked<OnDetectedCallback>;
  let probe: MockRefusalSweeperProbe;
  let sweeper: RefusalSweeper;

  beforeEach(() => {
    queue = createMockQueueRepo();
    github = createMockCoderabbitGitHubClient();
    onDetected = createMockOnDetectedCallback();
    probe = createMockRefusalSweeperProbe();
    const probes = createMockProbeFactory({ createRefusalSweeperProbe: jest.fn(() => probe) });
    sweeper = new RefusalSweeper(queue, github, onDetected, probes, createCoderabbitCommentClassifier());
  });

  describe('sweep', () => {
    it('returns 0 and does not start the probe when the active queue is empty', async () => {
      queue.getActiveQueue.mockResolvedValue([]);

      const result = await sweeper.sweep();

      expect(result).toBe(0);
      expect(probe.sweepStarted).not.toHaveBeenCalled();
      expect(probe.completed).not.toHaveBeenCalled();
      expect(github.fetchComment).not.toHaveBeenCalled();
      expect(onDetected).not.toHaveBeenCalled();
    });

    it('catches a fetch error, skips that item, and continues with the next', async () => {
      const failingRef = generateReviewRef();
      const failingItem = buildItem(failingRef);
      const nextRef = generateReviewRef();
      const nextItem = buildItem(nextRef);
      const error = new Error('Connection refused');
      queue.getActiveQueue.mockResolvedValue([failingItem, nextItem]);
      github.fetchComment
        .mockRejectedValueOnce(error)
        .mockResolvedValueOnce({ body: getUniqueString(), createdAt: getUniqueDate().toISOString(), updatedAt: getUniqueDate().toISOString() });

      const result = await sweeper.sweep();

      expect(result).toBe(0);
      expect(probe.sweepStarted).toHaveBeenCalledWith(2);
      expect(probe.itemFailed).toHaveBeenCalledWith(failingItem.repo_full_name, failingItem.pr_number, failingItem.source_comment_id, error);
      expect(github.fetchComment).toHaveBeenCalledWith(nextRef.owner, nextRef.repo, nextRef.commentId);
      expect(onDetected).not.toHaveBeenCalled();
      expect(probe.completed).toHaveBeenCalledWith(2, 0);
    });

    it('skips a comment that does not classify as a refusal', async () => {
      const ref = generateReviewRef();
      const item = buildItem(ref);
      queue.getActiveQueue.mockResolvedValue([item]);
      github.fetchComment.mockResolvedValue({ body: getUniqueString(), createdAt: getUniqueDate().toISOString(), updatedAt: getUniqueDate().toISOString() });

      const result = await sweeper.sweep();

      expect(result).toBe(0);
      expect(probe.itemFailed).not.toHaveBeenCalled();
      expect(onDetected).not.toHaveBeenCalled();
      expect(probe.completed).toHaveBeenCalledWith(1, 0);
    });

    it('detects a refusal and passes the full comment with the pull request id', async () => {
      const ref = generateReviewRef();
      const item = buildItem(ref);
      const body = refusalBody();
      const createdAt = getUniqueDate().toISOString();
      const updatedAt = getUniqueDate().toISOString();
      queue.getActiveQueue.mockResolvedValue([item]);
      github.fetchComment.mockResolvedValue({ body, createdAt, updatedAt });

      const result = await sweeper.sweep();

      expect(result).toBe(1);
      expect(probe.sweepStarted).toHaveBeenCalledWith(1);
      expect(github.fetchComment).toHaveBeenCalledWith(ref.owner, ref.repo, ref.commentId);
      expect(onDetected).toHaveBeenCalledWith(
        {
          url: item.source_comment_url,
          repoFullName: item.repo_full_name,
          prNumber: item.pr_number,
          commentId: item.source_comment_id,
          createdAt,
          updatedAt,
          prTitle: item.pr_title,
          body,
          commentType: 'review_refused',
          detectedVia: 'refusal_sweep',
        },
        item.pull_request_id,
      );
      expect(probe.completed).toHaveBeenCalledWith(1, 1);
    });

    it('catches an onDetected error and continues with the next item', async () => {
      const failingRef = generateReviewRef();
      const failingItem = buildItem(failingRef);
      const succeedingRef = generateReviewRef();
      const succeedingItem = buildItem(succeedingRef);
      const error = new Error('onDetected failed');
      const createdAt = getUniqueDate().toISOString();
      const updatedAt = getUniqueDate().toISOString();
      const succeedingBody = refusalBody();
      queue.getActiveQueue.mockResolvedValue([failingItem, succeedingItem]);
      github.fetchComment
        .mockResolvedValueOnce({ body: refusalBody(), createdAt, updatedAt })
        .mockResolvedValueOnce({ body: succeedingBody, createdAt, updatedAt });
      onDetected.mockRejectedValueOnce(error);

      const result = await sweeper.sweep();

      expect(result).toBe(1);
      expect(probe.itemFailed).toHaveBeenCalledWith(failingItem.repo_full_name, failingItem.pr_number, failingItem.source_comment_id, error);
      expect(onDetected).toHaveBeenCalledWith(
        {
          url: succeedingItem.source_comment_url,
          repoFullName: succeedingItem.repo_full_name,
          prNumber: succeedingItem.pr_number,
          commentId: succeedingItem.source_comment_id,
          createdAt,
          updatedAt,
          prTitle: succeedingItem.pr_title,
          body: succeedingBody,
          commentType: 'review_refused',
          detectedVia: 'refusal_sweep',
        },
        succeedingItem.pull_request_id,
      );
      expect(probe.completed).toHaveBeenCalledWith(2, 1);
    });
  });
});
