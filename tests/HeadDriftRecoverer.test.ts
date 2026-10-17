import { buildPrUrl } from '../src/github/index.js';
import { HeadDriftRecoverer, IgnoreRules } from '../src/services.js';
import type { UnreviewedHeadPR } from '../src/types/index.js';

import {
  createMockCoderabbitGitHubClient,
  createMockHeadDriftProbe,
  createMockPrismaClient,
  createMockProbeFactory,
  createMockPullRequestRepo,
  createMockQueueRepo,
  generateConfigData,
  generateQueueItemHydrationData,
} from './helpers/index.js';

import { getUniqueDate, getUniqueInt, getUniqueString } from '@couimet/dynamic-testing';
import { createMockLogger } from '@couimet/logger-contract-testing';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const GRACE_BOUND = new Date('2026-10-17T12:00:00.000Z');
const EXCLUDED_AUTHOR_PATTERN = '^renovate';

describe('HeadDriftRecoverer', () => {
  let pullRequests: ReturnType<typeof createMockPullRequestRepo>;
  let queue: ReturnType<typeof createMockQueueRepo>;
  let github: ReturnType<typeof createMockCoderabbitGitHubClient>;
  let ignoreRules: IgnoreRules;
  let prisma: ReturnType<typeof createMockPrismaClient>['prisma'];
  let probes: ReturnType<typeof createMockProbeFactory>;
  let probe: ReturnType<typeof createMockHeadDriftProbe>;
  let logger: ReturnType<typeof createMockLogger>;
  let tx: object;
  let frozenNow: Date;
  let owner: string;
  let repo: string;
  let repoFullName: string;
  let candidate: UnreviewedHeadPR;

  beforeEach(() => {
    pullRequests = createMockPullRequestRepo();
    queue = createMockQueueRepo();
    github = createMockCoderabbitGitHubClient();
    ignoreRules = new IgnoreRules(generateConfigData());
    probe = createMockHeadDriftProbe();
    probes = createMockProbeFactory({ createHeadDriftProbe: jest.fn(() => probe) });
    logger = createMockLogger();
    tx = { marker: getUniqueString() };
    prisma = createMockPrismaClient({ $transaction: jest.fn<any>().mockImplementation((fn: (client: unknown) => unknown) => fn(tx)) }).prisma;
    frozenNow = getUniqueDate();
    jest.useFakeTimers();
    jest.setSystemTime(frozenNow);

    owner = getUniqueString({ prefix: 'owner-' });
    repo = getUniqueString({ prefix: 'repo-' });
    repoFullName = `${owner}/${repo}`;
    candidate = {
      id: getUniqueInt(),
      repoFullName,
      prNumber: getUniqueInt(),
      title: getUniqueString({ prefix: 'title-' }),
      authorLogin: getUniqueString({ prefix: 'author-' }),
      headSha: getUniqueString({ prefix: 'head-' }),
      headCommittedAt: getUniqueDate(),
      reviewedHeadSha: null,
    };
  });

  const buildRecoverer = (rules: IgnoreRules) => new HeadDriftRecoverer(pullRequests, queue, github, rules, prisma, probes, logger);

  it('reports no drift when the candidate query returns nothing', async () => {
    pullRequests.findUnreviewedHeadPRs.mockResolvedValue([]);

    await buildRecoverer(ignoreRules).recover(GRACE_BOUND);

    expect(pullRequests.findUnreviewedHeadPRs).toHaveBeenCalledWith(GRACE_BOUND);
    expect(probe.noDriftFound).toHaveBeenCalledWith();
    expect(probe.withCandidate).not.toHaveBeenCalled();
    expect(github.findCompletedReview).not.toHaveBeenCalled();
    expect(queue.enqueue).not.toHaveBeenCalled();
  });

  it('records an approval that covers the head and enqueues nothing', async () => {
    const review = { htmlUrl: getUniqueString({ prefix: 'review-url-' }), reviewId: getUniqueInt(), isApproval: true, commitId: candidate.headSha };
    pullRequests.findUnreviewedHeadPRs.mockResolvedValue([candidate]);
    github.findCompletedReview.mockResolvedValue(review);

    await buildRecoverer(ignoreRules).recover(GRACE_BOUND);

    expect(probe.withCandidate).toHaveBeenCalledWith(candidate);
    expect(github.findCompletedReview).toHaveBeenCalledWith(owner, repo, candidate.prNumber, candidate.headCommittedAt, undefined, candidate.headSha);
    expect(pullRequests.recordReview).toHaveBeenCalledWith(candidate.id, review.htmlUrl, 'review_approved', candidate.headSha, tx);
    expect(probe.headAlreadyReviewed).toHaveBeenCalledWith(review.htmlUrl);
    expect(probe.headDriftFound).not.toHaveBeenCalled();
    expect(queue.enqueue).not.toHaveBeenCalled();
    expect(probe.recovered).not.toHaveBeenCalled();
  });

  it('records a changes-suggested review that covers the head', async () => {
    const review = { htmlUrl: getUniqueString({ prefix: 'review-url-' }), reviewId: getUniqueInt(), isApproval: false, commitId: candidate.headSha };
    pullRequests.findUnreviewedHeadPRs.mockResolvedValue([candidate]);
    github.findCompletedReview.mockResolvedValue(review);

    await buildRecoverer(ignoreRules).recover(GRACE_BOUND);

    expect(pullRequests.recordReview).toHaveBeenCalledWith(candidate.id, review.htmlUrl, 'review_changes_suggested', candidate.headSha, tx);
    expect(queue.enqueue).not.toHaveBeenCalled();
  });

  it('enqueues a pending item and records the recovery when no review covers the head', async () => {
    pullRequests.findUnreviewedHeadPRs.mockResolvedValue([candidate]);
    github.findCompletedReview.mockResolvedValue(undefined);
    queue.enqueue.mockResolvedValue({ item: generateQueueItemHydrationData(), created: true });

    await buildRecoverer(ignoreRules).recover(GRACE_BOUND);

    expect(probe.headDriftFound).toHaveBeenCalledWith();
    expect(queue.enqueue).toHaveBeenCalledWith(
      {
        repo: repoFullName,
        pr: candidate.prNumber,
        prTitle: candidate.title,
        sourceCommentUrl: buildPrUrl(repoFullName, candidate.prNumber),
        sourceCommentId: -frozenNow.getTime(),
        coderabbitRunId: undefined,
        cooldownUntil: undefined,
        sourceCommentType: undefined,
        pullRequestId: candidate.id,
      },
      tx,
    );
    expect(probe.recovered).toHaveBeenCalledWith(tx);
  });

  it('records no recovery event when the queue already holds the PR', async () => {
    pullRequests.findUnreviewedHeadPRs.mockResolvedValue([candidate]);
    github.findCompletedReview.mockResolvedValue(undefined);
    queue.enqueue.mockResolvedValue({ item: generateQueueItemHydrationData(), created: false });

    await buildRecoverer(ignoreRules).recover(GRACE_BOUND);

    expect(probe.headDriftFound).toHaveBeenCalledWith();
    expect(probe.recovered).not.toHaveBeenCalled();
  });

  it('drops a candidate whose author matches an ignore rule before the review check', async () => {
    const matchingCandidate = { ...candidate, authorLogin: 'renovate[bot]' };
    pullRequests.findUnreviewedHeadPRs.mockResolvedValue([matchingCandidate]);
    const rules = new IgnoreRules(generateConfigData({ IGNORE_AUTHORS: [EXCLUDED_AUTHOR_PATTERN] }));

    await buildRecoverer(rules).recover(GRACE_BOUND);

    expect(probe.withCandidate).toHaveBeenCalledWith(matchingCandidate);
    expect(probe.excluded).toHaveBeenCalledWith({ field: 'author', pattern: EXCLUDED_AUTHOR_PATTERN });
    expect(github.findCompletedReview).not.toHaveBeenCalled();
    expect(queue.enqueue).not.toHaveBeenCalled();
  });

  it('continues with the next candidate when one fails', async () => {
    const failure = new Error(getUniqueString({ prefix: 'failure-' }));
    const secondOwner = getUniqueString({ prefix: 'owner-' });
    const secondRepo = getUniqueString({ prefix: 'repo-' });
    const secondCandidate: UnreviewedHeadPR = {
      ...candidate,
      id: getUniqueInt(),
      repoFullName: `${secondOwner}/${secondRepo}`,
      prNumber: getUniqueInt(),
      headSha: getUniqueString({ prefix: 'head-' }),
      headCommittedAt: getUniqueDate(),
    };
    pullRequests.findUnreviewedHeadPRs.mockResolvedValue([candidate, secondCandidate]);
    github.findCompletedReview.mockRejectedValueOnce(failure).mockResolvedValueOnce(undefined);
    queue.enqueue.mockResolvedValue({ item: generateQueueItemHydrationData(), created: true });

    await buildRecoverer(ignoreRules).recover(GRACE_BOUND);

    expect(logger.warn).toHaveBeenCalledWith(
      { fn: 'HeadDriftRecoverer.recover', repoFullName, prNumber: candidate.prNumber, prId: candidate.id, error: failure },
      'Failed to recover an unreviewed head; will retry next tick',
    );
    expect(github.findCompletedReview).toHaveBeenCalledTimes(2);
    expect(probe.headDriftFound).toHaveBeenCalledTimes(1);
    expect(queue.enqueue).toHaveBeenCalledTimes(1);
  });

  it('rethrows a GitHub rate-limit error so the tick stops', async () => {
    const rateLimitError = {
      status: 429,
      response: { headers: { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': 'not-a-number' } },
    };
    const secondCandidate = { ...candidate, id: getUniqueInt(), prNumber: getUniqueInt() };
    pullRequests.findUnreviewedHeadPRs.mockResolvedValue([candidate, secondCandidate]);
    github.findCompletedReview.mockRejectedValue(rateLimitError);

    await expect(buildRecoverer(ignoreRules).recover(GRACE_BOUND)).rejects.toBe(rateLimitError);

    expect(github.findCompletedReview).toHaveBeenCalledTimes(1);
    expect(logger.warn).not.toHaveBeenCalled();
    expect(queue.enqueue).not.toHaveBeenCalled();
  });
});
