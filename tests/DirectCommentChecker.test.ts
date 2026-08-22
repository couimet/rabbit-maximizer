import { ExecutionContext } from '../src/external-deps/couimet/execution-context/src/index.js';
import { buildCommentUrl } from '../src/github/buildCommentUrl.js';
import { DirectCommentCheckProbe } from '../src/probes/index.js';
import { DirectCommentCheckerImpl } from '../src/services.js';
import type { EventLogEntry, OnDetectedCallback } from '../src/types/index.js';

import {
  createMockCoderabbitCommentRepo,
  createMockCoderabbitGitHubClient,
  createMockEventRepo,
  createMockOnDetectedCallback,
  createMockProbeFactory,
  createMockPullRequestRepo,
  createMockQueueRepo,
  generateCoderabbitCommentHydrationData,
  generateEventTraceContext,
  generateReviewRef,
} from './helpers/index.js';

import { getUniqueDate, getUniqueInt, getUuid } from '@couimet/dynamic-testing';
import { createMockLogger } from '@couimet/logger-contract-testing';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const SKIPPED_COMMENT_BODY = 'skip review by coderabbit.ai';
const APPROVED_COMMENT_BODY =
  'No actionable comments were generated in the recent review.\n\n<!-- rabbit-maximizer\n{"version":"0.1.0","triggerSource":"scheduler"}\n-->';
const REVIEW_LIMITED_BODY = 'rate limited by coderabbit.ai';
const REVIEW_LIMITED_WITH_WAIT = 'rate limited by coderabbit.ai\n\n**Next review available in:** **34 minutes**';
const ONE_MINUTE_MS = 60_000;
const WALKTHROUGH_BODY = 'review_stack_entry_start';

describe('DirectCommentCheckerImpl', () => {
  let github: ReturnType<typeof createMockCoderabbitGitHubClient>;
  let onDetected: jest.Mocked<OnDetectedCallback>;
  let coderabbitComments: ReturnType<typeof createMockCoderabbitCommentRepo>;
  let events: ReturnType<typeof createMockEventRepo>;
  let eventTrace: { correlationId: string; requestId: string; version: string };
  let queue: ReturnType<typeof createMockQueueRepo>;
  let pullRequests: ReturnType<typeof createMockPullRequestRepo>;
  let probeFactory: ReturnType<typeof createMockProbeFactory>;
  let logger: ReturnType<typeof createMockLogger>;
  let checker: DirectCommentCheckerImpl;

  const runInContext = <T>(fn: () => Promise<T>): Promise<T> =>
    ExecutionContext.run({ correlationId: eventTrace.correlationId, requestId: eventTrace.requestId, attributes: { version: eventTrace.version } }, fn);

  beforeEach(() => {
    eventTrace = generateEventTraceContext();
    github = createMockCoderabbitGitHubClient();
    onDetected = createMockOnDetectedCallback();
    coderabbitComments = createMockCoderabbitCommentRepo();
    coderabbitComments.findByCommentId.mockResolvedValue(undefined);
    events = createMockEventRepo();
    logger = createMockLogger();
    const probe = new DirectCommentCheckProbe(events, logger);
    probeFactory = createMockProbeFactory({ createDirectCommentCheckProbe: jest.fn().mockReturnValue(probe) });
    queue = createMockQueueRepo();
    pullRequests = createMockPullRequestRepo();
    checker = new DirectCommentCheckerImpl(github, onDetected, coderabbitComments, queue, pullRequests, probeFactory);
  });

  it('fetches comments and calls onDetected for rate-limit comments', async () => {
    const ref = generateReviewRef();
    const pullRequestId = getUniqueInt();
    const commentCreatedAt = getUniqueDate();
    const commentUpdatedAt = getUniqueDate();
    const commentId = getUniqueInt();
    github.listComments.mockResolvedValue([
      { user: 'coderabbitai[bot]', body: REVIEW_LIMITED_BODY, id: commentId, createdAt: commentCreatedAt, updatedAt: commentUpdatedAt },
    ]);

    const candidates = await checker.check([{ repoFullName: ref.repoFullName, prNumber: ref.prNumber, pullRequestId, prTitle: ref.prTitle }]);

    const [owner, repo] = ref.repoFullName.split('/');
    expect(github.listComments).toHaveBeenCalledWith(owner, repo, ref.prNumber);
    expect(onDetected).toHaveBeenCalledWith(
      {
        url: buildCommentUrl(ref.repoFullName, ref.prNumber, commentId),
        repoFullName: ref.repoFullName,
        prNumber: ref.prNumber,
        commentId,
        createdAt: commentCreatedAt.toISOString(),
        updatedAt: commentUpdatedAt.toISOString(),
        prTitle: ref.prTitle,
        body: REVIEW_LIMITED_BODY,
        commentType: 'review_limited',
      },
      pullRequestId,
    );
    expect(candidates).toStrictEqual([{ updatedAt: commentUpdatedAt, waitSeconds: undefined }]);
    expect(logger.info).toHaveBeenCalledWith({ fn: 'DirectCommentCheckProbe.found', found: 1, checked: 1 }, 'Direct comment check found comments');
  });

  it('skips comments with unknown classification', async () => {
    const ref = generateReviewRef();
    const commentId = getUniqueInt();
    github.listComments.mockResolvedValue([
      { user: 'coderabbitai[bot]', body: 'regular comment', id: commentId, createdAt: getUniqueDate(), updatedAt: getUniqueDate() },
    ]);

    const candidates = await checker.check([{ repoFullName: ref.repoFullName, prNumber: ref.prNumber, pullRequestId: getUniqueInt(), prTitle: ref.prTitle }]);

    expect(onDetected).not.toHaveBeenCalled();
    expect(candidates).toStrictEqual([]);
    expect(logger.warn).not.toHaveBeenCalled();
    expect(logger.info).not.toHaveBeenCalled();
    expect(logger.debug).toHaveBeenCalledWith(
      { fn: 'DirectCommentCheckProbe.skippedUnclassified', repo: ref.repoFullName, pr: ref.prNumber, commentId },
      'Skipping comment with unknown classification',
    );
  });

  it('records a walkthrough review when an unknown comment carries the stack marker on a never-enqueued PR', async () => {
    const ref = generateReviewRef();
    const pullRequestId = getUniqueInt();
    const commentUpdatedAt = getUniqueDate();
    const commentId = getUniqueInt();
    github.listComments.mockResolvedValue([
      { user: 'coderabbitai[bot]', body: WALKTHROUGH_BODY, id: commentId, createdAt: commentUpdatedAt, updatedAt: commentUpdatedAt },
    ]);

    await runInContext(() => checker.check([{ repoFullName: ref.repoFullName, prNumber: ref.prNumber, pullRequestId, prTitle: ref.prTitle }]));

    expect(queue.existsByPullRequestId).toHaveBeenCalledWith(pullRequestId);
    expect(coderabbitComments.findByCommentId).toHaveBeenCalledWith(pullRequestId, commentId);
    expect(coderabbitComments.upsert).toHaveBeenCalledWith({
      comment_id: commentId,
      pull_request_id: pullRequestId,
      url: buildCommentUrl(ref.repoFullName, ref.prNumber, commentId),
      comment_type: 'unknown',
      body: WALKTHROUGH_BODY,
      gh_created_at: commentUpdatedAt,
      gh_updated_at: commentUpdatedAt,
      coderabbit_run_id: null,
    });
    expect(pullRequests.recordWalkthroughReview).toHaveBeenCalledWith(pullRequestId, commentUpdatedAt);
    expect(logger.info).toHaveBeenCalledWith(
      { fn: 'DirectCommentCheckProbe.walkthroughRecorded', repo: ref.repoFullName, pr: ref.prNumber, commentId, reviewedAt: commentUpdatedAt.toISOString() },
      'Recorded walkthrough review activity',
    );
    expect(logger.debug).not.toHaveBeenCalled();
    expect(onDetected).not.toHaveBeenCalled();
  });

  it('does not re-record a walkthrough already latched with last_seen_at at or after the comment update', async () => {
    const ref = generateReviewRef();
    const pullRequestId = getUniqueInt();
    const commentUpdatedAt = getUniqueDate();
    const commentId = getUniqueInt();
    github.listComments.mockResolvedValue([
      { user: 'coderabbitai[bot]', body: WALKTHROUGH_BODY, id: commentId, createdAt: commentUpdatedAt, updatedAt: commentUpdatedAt },
    ]);
    coderabbitComments.findByCommentId.mockResolvedValue(
      generateCoderabbitCommentHydrationData({
        comment_id: commentId,
        last_seen_at: commentUpdatedAt,
        coderabbit_run_id: null,
      }),
    );

    await checker.check([{ repoFullName: ref.repoFullName, prNumber: ref.prNumber, pullRequestId, prTitle: ref.prTitle }]);

    expect(coderabbitComments.findByCommentId).toHaveBeenCalledWith(pullRequestId, commentId);
    expect(coderabbitComments.upsert).not.toHaveBeenCalled();
    expect(pullRequests.recordWalkthroughReview).not.toHaveBeenCalled();
    expect(logger.info).not.toHaveBeenCalled();
    expect(logger.debug).toHaveBeenCalledWith(
      { fn: 'DirectCommentCheckProbe.skippedAlreadySeen', repo: ref.repoFullName, pr: ref.prNumber, commentId },
      'Skipping comment already processed and not edited since',
    );
    expect(onDetected).not.toHaveBeenCalled();
  });

  it('skips walkthrough comments when a queue item exists for the PR', async () => {
    const ref = generateReviewRef();
    const pullRequestId = getUniqueInt();
    const commentCreatedAt = getUniqueDate();
    const commentId = getUniqueInt();
    queue.existsByPullRequestId.mockResolvedValue(true);
    github.listComments.mockResolvedValue([
      { user: 'coderabbitai[bot]', body: WALKTHROUGH_BODY, id: commentId, createdAt: commentCreatedAt, updatedAt: commentCreatedAt },
    ]);

    await runInContext(() => checker.check([{ repoFullName: ref.repoFullName, prNumber: ref.prNumber, pullRequestId, prTitle: ref.prTitle }]));

    expect(pullRequests.recordWalkthroughReview).not.toHaveBeenCalled();
    expect(logger.debug).toHaveBeenCalledWith(
      { fn: 'DirectCommentCheckProbe.skippedUnclassified', repo: ref.repoFullName, pr: ref.prNumber, commentId },
      'Skipping comment with unknown classification',
    );
    expect(onDetected).not.toHaveBeenCalled();
  });

  it('detects review_skipped comments and calls onDetected', async () => {
    const ref = generateReviewRef();
    const pullRequestId = getUniqueInt();
    const commentCreatedAt = getUniqueDate();
    const commentUpdatedAt = getUniqueDate();
    const commentId = getUniqueInt();
    github.listComments.mockResolvedValue([
      { user: 'coderabbitai[bot]', body: SKIPPED_COMMENT_BODY, id: commentId, createdAt: commentCreatedAt, updatedAt: commentUpdatedAt },
    ]);

    await runInContext(() => checker.check([{ repoFullName: ref.repoFullName, prNumber: ref.prNumber, pullRequestId, prTitle: ref.prTitle }]));

    const [owner, repo] = ref.repoFullName.split('/');
    expect(github.listComments).toHaveBeenCalledWith(owner, repo, ref.prNumber);
    expect(onDetected).toHaveBeenCalledWith(
      {
        url: buildCommentUrl(ref.repoFullName, ref.prNumber, commentId),
        repoFullName: ref.repoFullName,
        prNumber: ref.prNumber,
        commentId,
        createdAt: commentCreatedAt.toISOString(),
        updatedAt: commentUpdatedAt.toISOString(),
        prTitle: ref.prTitle,
        body: SKIPPED_COMMENT_BODY,
        commentType: 'review_skipped',
      },
      pullRequestId,
    );
    expect(logger.info).toHaveBeenCalledWith({ fn: 'DirectCommentCheckProbe.found', found: 1, checked: 1 }, 'Direct comment check found comments');
  });

  it('skips stale comments already processed and not edited since', async () => {
    const ref = generateReviewRef();
    const pullRequestId = getUniqueInt();
    const commentUpdatedAt = getUniqueDate();
    const lastSeenAt = commentUpdatedAt;
    const commentId = getUniqueInt();
    github.listComments.mockResolvedValue([
      { user: 'coderabbitai[bot]', body: REVIEW_LIMITED_BODY, id: commentId, createdAt: commentUpdatedAt, updatedAt: commentUpdatedAt },
    ]);
    coderabbitComments.findByCommentId.mockResolvedValue(
      generateCoderabbitCommentHydrationData({
        comment_id: commentId,
        last_seen_at: lastSeenAt,
        coderabbit_run_id: null,
      }),
    );

    const candidates = await checker.check([{ repoFullName: ref.repoFullName, prNumber: ref.prNumber, pullRequestId, prTitle: ref.prTitle }]);

    expect(coderabbitComments.findByCommentId).toHaveBeenCalledWith(pullRequestId, commentId);
    expect(onDetected).not.toHaveBeenCalled();
    expect(candidates).toStrictEqual([]);
    expect(logger.info).not.toHaveBeenCalled();
    expect(logger.debug).toHaveBeenCalledWith(
      { fn: 'DirectCommentCheckProbe.skippedAlreadySeen', repo: ref.repoFullName, pr: ref.prNumber, commentId },
      'Skipping comment already processed and not edited since',
    );
  });

  it('calls onDetected for edited comments with updatedAt newer than last_seen_at', async () => {
    const ref = generateReviewRef();
    const pullRequestId = getUniqueInt();
    const commentCreatedAt = getUniqueDate();
    const lastSeenAt = getUniqueDate();
    const commentUpdatedAt = new Date(lastSeenAt.getTime() + ONE_MINUTE_MS);
    const commentId = getUniqueInt();
    github.listComments.mockResolvedValue([
      { user: 'coderabbitai[bot]', body: SKIPPED_COMMENT_BODY, id: commentId, createdAt: commentCreatedAt, updatedAt: commentUpdatedAt },
    ]);
    coderabbitComments.findByCommentId.mockResolvedValue(
      generateCoderabbitCommentHydrationData({
        comment_id: commentId,
        last_seen_at: lastSeenAt,
        coderabbit_run_id: null,
      }),
    );

    await runInContext(() => checker.check([{ repoFullName: ref.repoFullName, prNumber: ref.prNumber, pullRequestId, prTitle: ref.prTitle }]));

    expect(onDetected).toHaveBeenCalledWith(
      {
        url: buildCommentUrl(ref.repoFullName, ref.prNumber, commentId),
        repoFullName: ref.repoFullName,
        prNumber: ref.prNumber,
        commentId,
        createdAt: commentCreatedAt.toISOString(),
        updatedAt: commentUpdatedAt.toISOString(),
        prTitle: ref.prTitle,
        body: SKIPPED_COMMENT_BODY,
        commentType: 'review_skipped',
      },
      pullRequestId,
    );
    expect(logger.info).toHaveBeenCalledWith({ fn: 'DirectCommentCheckProbe.found', found: 1, checked: 1 }, 'Direct comment check found comments');
  });

  it('records a run id change event when the stored row carries a different CodeRabbit run id', async () => {
    const ref = generateReviewRef();
    const pullRequestId = getUniqueInt();
    const commentUpdatedAt = getUniqueDate();
    const commentId = getUniqueInt();
    const storedRunId = getUuid();
    const freshRunId = getUuid();
    const eventUuid = getUuid();
    events.record.mockResolvedValue({ uuid: eventUuid } as EventLogEntry);
    github.listComments.mockResolvedValue([
      {
        user: 'coderabbitai[bot]',
        body: `${SKIPPED_COMMENT_BODY}\n\n**Run ID**: \`${freshRunId}\``,
        id: commentId,
        createdAt: commentUpdatedAt,
        updatedAt: commentUpdatedAt,
      },
    ]);
    coderabbitComments.findByCommentId.mockResolvedValue(
      generateCoderabbitCommentHydrationData({
        comment_id: commentId,
        last_seen_at: new Date(commentUpdatedAt.getTime() - ONE_MINUTE_MS),
        coderabbit_run_id: storedRunId,
      }),
    );

    await runInContext(() => checker.check([{ repoFullName: ref.repoFullName, prNumber: ref.prNumber, pullRequestId, prTitle: ref.prTitle }]));

    expect(events.record).toHaveBeenCalledWith(
      {
        type: 'coderabbit_run_id_changed',
        repo_full_name: ref.repoFullName,
        pr_number: ref.prNumber,
        correlation_id: eventTrace.correlationId,
        request_id: eventTrace.requestId,
        version: eventTrace.version,
        payload: {
          comment_id: commentId,
          comment_url: buildCommentUrl(ref.repoFullName, ref.prNumber, commentId),
          previous_coderabbit_run_id: storedRunId,
          coderabbit_run_id: freshRunId,
        },
      },
      undefined,
    );
    expect(logger.info).toHaveBeenCalledWith(
      {
        fn: 'DirectCommentCheckProbe.runIdChanged',
        repo: ref.repoFullName,
        pr: ref.prNumber,
        commentId,
        eventUuid,
        previousCoderabbitRunId: storedRunId,
        coderabbitRunId: freshRunId,
      },
      'CodeRabbit run id changed',
    );
    expect(onDetected).toHaveBeenCalled();
  });

  it('records a run id first-seen event when the stored row carries no CodeRabbit run id', async () => {
    const ref = generateReviewRef();
    const pullRequestId = getUniqueInt();
    const commentUpdatedAt = getUniqueDate();
    const commentId = getUniqueInt();
    const freshRunId = getUuid();
    const eventUuid = getUuid();
    events.record.mockResolvedValue({ uuid: eventUuid } as EventLogEntry);
    github.listComments.mockResolvedValue([
      {
        user: 'coderabbitai[bot]',
        body: `${SKIPPED_COMMENT_BODY}\n\n**Run ID**: \`${freshRunId}\``,
        id: commentId,
        createdAt: commentUpdatedAt,
        updatedAt: commentUpdatedAt,
      },
    ]);
    coderabbitComments.findByCommentId.mockResolvedValue(
      generateCoderabbitCommentHydrationData({
        comment_id: commentId,
        last_seen_at: new Date(commentUpdatedAt.getTime() - ONE_MINUTE_MS),
        coderabbit_run_id: null,
      }),
    );

    await runInContext(() => checker.check([{ repoFullName: ref.repoFullName, prNumber: ref.prNumber, pullRequestId, prTitle: ref.prTitle }]));

    expect(events.record).toHaveBeenCalledWith(
      {
        type: 'coderabbit_run_id_first_seen',
        repo_full_name: ref.repoFullName,
        pr_number: ref.prNumber,
        correlation_id: eventTrace.correlationId,
        request_id: eventTrace.requestId,
        version: eventTrace.version,
        payload: {
          comment_id: commentId,
          comment_url: buildCommentUrl(ref.repoFullName, ref.prNumber, commentId),
          coderabbit_run_id: freshRunId,
        },
      },
      undefined,
    );
    expect(logger.info).toHaveBeenCalledWith(
      { fn: 'DirectCommentCheckProbe.runIdFirstSeen', repo: ref.repoFullName, pr: ref.prNumber, commentId, eventUuid, coderabbitRunId: freshRunId },
      'CodeRabbit run id observed for the first time',
    );
    expect(onDetected).toHaveBeenCalled();
  });

  it('records a run id cleared event when the fresh body carries no CodeRabbit run id', async () => {
    const ref = generateReviewRef();
    const pullRequestId = getUniqueInt();
    const commentUpdatedAt = getUniqueDate();
    const commentId = getUniqueInt();
    const storedRunId = getUuid();
    const eventUuid = getUuid();
    events.record.mockResolvedValue({ uuid: eventUuid } as EventLogEntry);
    github.listComments.mockResolvedValue([
      {
        user: 'coderabbitai[bot]',
        body: SKIPPED_COMMENT_BODY,
        id: commentId,
        createdAt: commentUpdatedAt,
        updatedAt: commentUpdatedAt,
      },
    ]);
    coderabbitComments.findByCommentId.mockResolvedValue(
      generateCoderabbitCommentHydrationData({
        comment_id: commentId,
        last_seen_at: new Date(commentUpdatedAt.getTime() - ONE_MINUTE_MS),
        coderabbit_run_id: storedRunId,
      }),
    );

    await runInContext(() => checker.check([{ repoFullName: ref.repoFullName, prNumber: ref.prNumber, pullRequestId, prTitle: ref.prTitle }]));

    expect(events.record).toHaveBeenCalledWith(
      {
        type: 'coderabbit_run_id_cleared',
        repo_full_name: ref.repoFullName,
        pr_number: ref.prNumber,
        correlation_id: eventTrace.correlationId,
        request_id: eventTrace.requestId,
        version: eventTrace.version,
        payload: {
          comment_id: commentId,
          comment_url: buildCommentUrl(ref.repoFullName, ref.prNumber, commentId),
          previous_coderabbit_run_id: storedRunId,
        },
      },
      undefined,
    );
    expect(logger.info).toHaveBeenCalledWith(
      { fn: 'DirectCommentCheckProbe.runIdCleared', repo: ref.repoFullName, pr: ref.prNumber, commentId, eventUuid, previousCoderabbitRunId: storedRunId },
      'CodeRabbit run id cleared',
    );
    expect(onDetected).toHaveBeenCalled();
  });

  it('does not record a run id event when the stored row carries the same run id', async () => {
    const ref = generateReviewRef();
    const pullRequestId = getUniqueInt();
    const commentUpdatedAt = getUniqueDate();
    const commentId = getUniqueInt();
    const storedRunId = getUuid();
    github.listComments.mockResolvedValue([
      {
        user: 'coderabbitai[bot]',
        body: `${SKIPPED_COMMENT_BODY}\n\n**Run ID**: \`${storedRunId}\``,
        id: commentId,
        createdAt: commentUpdatedAt,
        updatedAt: commentUpdatedAt,
      },
    ]);
    coderabbitComments.findByCommentId.mockResolvedValue(
      generateCoderabbitCommentHydrationData({
        comment_id: commentId,
        last_seen_at: new Date(commentUpdatedAt.getTime() - ONE_MINUTE_MS),
        coderabbit_run_id: storedRunId,
      }),
    );

    await runInContext(() => checker.check([{ repoFullName: ref.repoFullName, prNumber: ref.prNumber, pullRequestId, prTitle: ref.prTitle }]));

    expect(events.record).not.toHaveBeenCalled();
    expect(onDetected).toHaveBeenCalled();
  });

  it('calls onDetected for first-seen comments with no stored row', async () => {
    const ref = generateReviewRef();
    const pullRequestId = getUniqueInt();
    const commentCreatedAt = getUniqueDate();
    const commentUpdatedAt = getUniqueDate();
    const commentId = getUniqueInt();
    github.listComments.mockResolvedValue([
      { user: 'coderabbitai[bot]', body: REVIEW_LIMITED_BODY, id: commentId, createdAt: commentCreatedAt, updatedAt: commentUpdatedAt },
    ]);

    await runInContext(() => checker.check([{ repoFullName: ref.repoFullName, prNumber: ref.prNumber, pullRequestId, prTitle: ref.prTitle }]));

    expect(coderabbitComments.findByCommentId).toHaveBeenCalledWith(pullRequestId, commentId);
    expect(onDetected).toHaveBeenCalledWith(
      {
        url: buildCommentUrl(ref.repoFullName, ref.prNumber, commentId),
        repoFullName: ref.repoFullName,
        prNumber: ref.prNumber,
        commentId,
        createdAt: commentCreatedAt.toISOString(),
        updatedAt: commentUpdatedAt.toISOString(),
        prTitle: ref.prTitle,
        body: REVIEW_LIMITED_BODY,
        commentType: 'review_limited',
      },
      pullRequestId,
    );
    expect(logger.info).toHaveBeenCalledWith({ fn: 'DirectCommentCheckProbe.found', found: 1, checked: 1 }, 'Direct comment check found comments');
  });

  it('skips comments with own retrigger marker', async () => {
    const ref = generateReviewRef();
    const commentId = getUniqueInt();
    github.listComments.mockResolvedValue([
      {
        user: 'coderabbitai[bot]',
        body: 'rate limited by coderabbit.ai\n\n<!-- rabbit-maximizer\n{"version":"0.1.0","triggerSource":"scheduler"}\n-->',
        id: commentId,
        createdAt: getUniqueDate(),
        updatedAt: getUniqueDate(),
      },
    ]);

    await checker.check([{ repoFullName: ref.repoFullName, prNumber: ref.prNumber, pullRequestId: getUniqueInt(), prTitle: ref.prTitle }]);

    expect(onDetected).not.toHaveBeenCalled();
    expect(logger.warn).not.toHaveBeenCalled();
    expect(logger.info).not.toHaveBeenCalled();
    expect(logger.debug).toHaveBeenCalledWith(
      { fn: 'DirectCommentCheckProbe.skippedOwnRetrigger', repo: ref.repoFullName, pr: ref.prNumber, commentId },
      'Skipping own retrigger comment',
    );
  });

  it('forwards review_approved comments with own retrigger marker (not skipped)', async () => {
    const ref = generateReviewRef();
    const pullRequestId = getUniqueInt();
    const commentCreatedAt = getUniqueDate();
    const commentUpdatedAt = getUniqueDate();
    const commentId = getUniqueInt();
    github.listComments.mockResolvedValue([
      {
        user: 'coderabbitai[bot]',
        body: APPROVED_COMMENT_BODY,
        id: commentId,
        createdAt: commentCreatedAt,
        updatedAt: commentUpdatedAt,
      },
    ]);

    await runInContext(() => checker.check([{ repoFullName: ref.repoFullName, prNumber: ref.prNumber, pullRequestId, prTitle: ref.prTitle }]));

    expect(onDetected).toHaveBeenCalledWith(
      {
        url: buildCommentUrl(ref.repoFullName, ref.prNumber, commentId),
        repoFullName: ref.repoFullName,
        prNumber: ref.prNumber,
        commentId,
        createdAt: commentCreatedAt.toISOString(),
        updatedAt: commentUpdatedAt.toISOString(),
        prTitle: ref.prTitle,
        body: APPROVED_COMMENT_BODY,
        commentType: 'review_approved',
      },
      pullRequestId,
    );
    expect(logger.info).toHaveBeenCalledWith({ fn: 'DirectCommentCheckProbe.found', found: 1, checked: 1 }, 'Direct comment check found comments');
  });

  it('continues processing remaining PRs when listComments throws for one', async () => {
    const ref1 = generateReviewRef();
    const ref2 = generateReviewRef();
    const apiError = new Error('API error');
    const goodComment = {
      user: 'coderabbitai[bot]',
      body: 'rate limited by coderabbit.ai',
      id: getUniqueInt(),
      createdAt: getUniqueDate(),
      updatedAt: getUniqueDate(),
    };
    github.listComments.mockRejectedValueOnce(apiError).mockResolvedValueOnce([goodComment]);

    await checker.check([
      { repoFullName: ref1.repoFullName, prNumber: ref1.prNumber, pullRequestId: getUniqueInt(), prTitle: ref1.prTitle },
      { repoFullName: ref2.repoFullName, prNumber: ref2.prNumber, pullRequestId: getUniqueInt(), prTitle: ref2.prTitle },
    ]);

    expect(logger.warn).toHaveBeenCalledWith(
      { fn: 'DirectCommentCheckProbe.prCheckFailed', repoFullName: ref1.repoFullName, prNumber: ref1.prNumber, error: apiError },
      'Failed to direct-check PR comments; continuing',
    );
    expect(onDetected).toHaveBeenCalledTimes(1);
  });

  it('does nothing when input array is empty', async () => {
    const candidates = await checker.check([]);

    expect(github.listComments).not.toHaveBeenCalled();
    expect(onDetected).not.toHaveBeenCalled();
    expect(candidates).toStrictEqual([]);
    expect(logger.warn).not.toHaveBeenCalled();
    expect(logger.info).not.toHaveBeenCalled();
  });

  it('skips non-CodeRabbit comments even when they contain the rate-limit marker', async () => {
    const ref = generateReviewRef();
    const commentId = getUniqueInt();
    const commentCreatedAt = getUniqueDate();
    const commentUpdatedAt = getUniqueDate();
    github.listComments.mockResolvedValue([
      { user: 'some-other-user', body: 'rate limited by coderabbit.ai', id: commentId, createdAt: commentCreatedAt, updatedAt: commentUpdatedAt },
    ]);

    await checker.check([{ repoFullName: ref.repoFullName, prNumber: ref.prNumber, pullRequestId: getUniqueInt(), prTitle: ref.prTitle }]);

    expect(onDetected).not.toHaveBeenCalled();
    expect(logger.info).not.toHaveBeenCalled();
  });

  it('returns ReviewLimitCandidate with parsed waitSeconds for review_limited comments', async () => {
    const ref = generateReviewRef();
    const pullRequestId = getUniqueInt();
    const commentUpdatedAt = getUniqueDate();
    const commentId = getUniqueInt();
    github.listComments.mockResolvedValue([
      { user: 'coderabbitai[bot]', body: REVIEW_LIMITED_WITH_WAIT, id: commentId, createdAt: getUniqueDate(), updatedAt: commentUpdatedAt },
    ]);

    const candidates = await checker.check([{ repoFullName: ref.repoFullName, prNumber: ref.prNumber, pullRequestId, prTitle: ref.prTitle }]);

    expect(candidates).toStrictEqual([{ updatedAt: commentUpdatedAt, waitSeconds: 2040 }]);
    expect(onDetected).toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledWith({ fn: 'DirectCommentCheckProbe.found', found: 1, checked: 1 }, 'Direct comment check found comments');
  });

  it('returns empty array for review_skipped comments', async () => {
    const ref = generateReviewRef();
    const pullRequestId = getUniqueInt();
    github.listComments.mockResolvedValue([
      { user: 'coderabbitai[bot]', body: SKIPPED_COMMENT_BODY, id: getUniqueInt(), createdAt: getUniqueDate(), updatedAt: getUniqueDate() },
    ]);

    const candidates = await checker.check([{ repoFullName: ref.repoFullName, prNumber: ref.prNumber, pullRequestId, prTitle: ref.prTitle }]);

    expect(candidates).toStrictEqual([]);
    expect(onDetected).toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledWith({ fn: 'DirectCommentCheckProbe.found', found: 1, checked: 1 }, 'Direct comment check found comments');
  });

  it('truncates and warns when PR count exceeds the direct-check limit', async () => {
    const ref = generateReviewRef();
    github.listComments.mockResolvedValue([]);
    const prs = Array.from({ length: 130 }, () => ({
      repoFullName: ref.repoFullName,
      prNumber: getUniqueInt(),
      pullRequestId: getUniqueInt(),
      prTitle: ref.prTitle,
    }));

    await checker.check(prs);

    expect(github.listComments).toHaveBeenCalledTimes(125);
    expect(logger.warn).toHaveBeenCalledWith(
      { fn: 'DirectCommentCheckProbe.truncated', prCount: 130, maxDirectCheckPRs: 125 },
      'PR count exceeds direct-check limit; truncating to prevent API rate-limit exhaustion',
    );
  });
});
