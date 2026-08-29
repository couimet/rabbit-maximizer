import { ExecutionContext } from '../../src/external-deps/couimet/execution-context/src/index.js';
import { DirectCommentCheckProbe } from '../../src/probes/index.js';
import type { EventLogEntry } from '../../src/types/index.js';
import { createMockEventRepo, generateEventTraceContext, generateReviewRef } from '../helpers/index.js';

import { getUniqueDate, getUniqueInt, getUniqueString, getUuid } from '@couimet/dynamic-testing';
import { createMockLogger } from '@couimet/logger-contract-testing';
import { beforeEach, describe, expect, it } from '@jest/globals';

describe('DirectCommentCheckProbe', () => {
  let events: ReturnType<typeof createMockEventRepo>;
  let eventTrace: { correlationId: string; requestId: string; version: string };
  let logger: ReturnType<typeof createMockLogger>;

  const runInContext = <T>(fn: () => Promise<T>): Promise<T> =>
    ExecutionContext.run({ correlationId: eventTrace.correlationId, requestId: eventTrace.requestId, attributes: { version: eventTrace.version } }, fn);

  beforeEach(() => {
    eventTrace = generateEventTraceContext();
    events = createMockEventRepo();
    logger = createMockLogger();
  });

  const createProbe = () => new DirectCommentCheckProbe(events, logger);

  it('logs a warn when the PR count is truncated to the direct-check limit', () => {
    const probe = createProbe();
    const prCount = getUniqueInt();
    const maxDirectCheckPRs = getUniqueInt();
    probe.truncated(prCount, maxDirectCheckPRs);
    expect(logger.warn).toHaveBeenCalledWith(
      { fn: 'DirectCommentCheckProbe.truncated', prCount, maxDirectCheckPRs },
      'PR count exceeds direct-check limit; truncating to prevent API rate-limit exhaustion',
    );
  });

  it('logs a debug when a comment has an unknown classification', () => {
    const ref = generateReviewRef();
    const commentId = getUniqueInt();
    const probe = createProbe();
    probe.withComment(ref.repoFullName, ref.prNumber, commentId);
    probe.skippedUnclassified();
    expect(logger.debug).toHaveBeenCalledWith(
      { fn: 'DirectCommentCheckProbe.skippedUnclassified', repo: ref.repoFullName, pr: ref.prNumber, commentId },
      'Skipping comment with unknown classification',
    );
  });

  it('logs an info when a walkthrough review is recorded', () => {
    const ref = generateReviewRef();
    const commentId = getUniqueInt();
    const reviewedAt = getUniqueDate();
    const probe = createProbe();
    probe.withComment(ref.repoFullName, ref.prNumber, commentId);
    probe.walkthroughRecorded(reviewedAt);
    expect(logger.info).toHaveBeenCalledWith(
      { fn: 'DirectCommentCheckProbe.walkthroughRecorded', repo: ref.repoFullName, pr: ref.prNumber, commentId, reviewedAt: reviewedAt.toISOString() },
      'Recorded walkthrough review activity',
    );
  });

  it('logs a debug when skipping an own retrigger comment', () => {
    const ref = generateReviewRef();
    const commentId = getUniqueInt();
    const probe = createProbe();
    probe.withComment(ref.repoFullName, ref.prNumber, commentId);
    probe.skippedOwnRetrigger();
    expect(logger.debug).toHaveBeenCalledWith(
      { fn: 'DirectCommentCheckProbe.skippedOwnRetrigger', repo: ref.repoFullName, pr: ref.prNumber, commentId },
      'Skipping own retrigger comment',
    );
  });

  it('logs a debug when skipping a comment already processed and not edited since', () => {
    const ref = generateReviewRef();
    const commentId = getUniqueInt();
    const probe = createProbe();
    probe.withComment(ref.repoFullName, ref.prNumber, commentId);
    probe.skippedAlreadySeen();
    expect(logger.debug).toHaveBeenCalledWith(
      { fn: 'DirectCommentCheckProbe.skippedAlreadySeen', repo: ref.repoFullName, pr: ref.prNumber, commentId },
      'Skipping comment already processed and not edited since',
    );
  });

  it('logs a warn when a PR check fails', () => {
    const ref = generateReviewRef();
    const error = new Error('API error');
    const probe = createProbe();
    probe.prCheckFailed(ref.repoFullName, ref.prNumber, error);
    expect(logger.warn).toHaveBeenCalledWith(
      { fn: 'DirectCommentCheckProbe.prCheckFailed', repoFullName: ref.repoFullName, prNumber: ref.prNumber, error },
      'Failed to direct-check PR comments; continuing',
    );
  });

  it('logs an info with the found and checked counts', () => {
    const probe = createProbe();
    const found = getUniqueInt();
    const checked = getUniqueInt();
    probe.found(found, checked);
    expect(logger.info).toHaveBeenCalledWith({ fn: 'DirectCommentCheckProbe.found', found, checked }, 'Direct comment check found comments');
  });

  it('records a coderabbit_run_id_first_seen event and logs the outcome', async () => {
    const ref = generateReviewRef();
    const commentId = getUniqueInt();
    const commentUrl = getUniqueString({ prefix: 'https://gh/c/' });
    const coderabbitRunId = getUuid();
    const eventUuid = getUuid();
    events.record.mockResolvedValue({ uuid: eventUuid } as EventLogEntry);
    const probe = createProbe();

    probe.withComment(ref.repoFullName, ref.prNumber, commentId);
    await runInContext(() => probe.runIdFirstSeen(commentUrl, coderabbitRunId));

    expect(events.record).toHaveBeenCalledWith(
      {
        type: 'coderabbit_run_id_first_seen',
        repo_full_name: ref.repoFullName,
        pr_number: ref.prNumber,
        correlation_id: eventTrace.correlationId,
        request_id: eventTrace.requestId,
        version: eventTrace.version,
        payload: { comment_id: commentId, comment_url: commentUrl, coderabbit_run_id: coderabbitRunId },
      },
      undefined,
    );
    expect(logger.info).toHaveBeenCalledWith(
      { fn: 'DirectCommentCheckProbe.runIdFirstSeen', repo: ref.repoFullName, pr: ref.prNumber, commentId, eventUuid, coderabbitRunId },
      'CodeRabbit run id observed for the first time',
    );
  });

  it('records a coderabbit_run_id_changed event and logs the outcome', async () => {
    const ref = generateReviewRef();
    const commentId = getUniqueInt();
    const commentUrl = getUniqueString({ prefix: 'https://gh/c/' });
    const previousRunId = getUuid();
    const coderabbitRunId = getUuid();
    const eventUuid = getUuid();
    events.record.mockResolvedValue({ uuid: eventUuid } as EventLogEntry);
    const probe = createProbe();

    probe.withComment(ref.repoFullName, ref.prNumber, commentId);
    await runInContext(() => probe.runIdChanged(commentUrl, previousRunId, coderabbitRunId));

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
          comment_url: commentUrl,
          previous_coderabbit_run_id: previousRunId,
          coderabbit_run_id: coderabbitRunId,
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
        previousCoderabbitRunId: previousRunId,
        coderabbitRunId,
      },
      'CodeRabbit run id changed',
    );
  });

  it('records a coderabbit_run_id_cleared event and logs the outcome', async () => {
    const ref = generateReviewRef();
    const commentId = getUniqueInt();
    const commentUrl = getUniqueString({ prefix: 'https://gh/c/' });
    const previousRunId = getUuid();
    const eventUuid = getUuid();
    events.record.mockResolvedValue({ uuid: eventUuid } as EventLogEntry);
    const probe = createProbe();

    probe.withComment(ref.repoFullName, ref.prNumber, commentId);
    await runInContext(() => probe.runIdCleared(commentUrl, previousRunId));

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
          comment_url: commentUrl,
          previous_coderabbit_run_id: previousRunId,
        },
      },
      undefined,
    );
    expect(logger.info).toHaveBeenCalledWith(
      { fn: 'DirectCommentCheckProbe.runIdCleared', repo: ref.repoFullName, pr: ref.prNumber, commentId, eventUuid, previousCoderabbitRunId: previousRunId },
      'CodeRabbit run id cleared',
    );
  });

  it('uses the most recent withComment binding', () => {
    const firstRef = generateReviewRef();
    const secondRef = generateReviewRef();
    const secondCommentId = getUniqueInt();
    const probe = createProbe();
    probe.withComment(firstRef.repoFullName, firstRef.prNumber, getUniqueInt());
    probe.withComment(secondRef.repoFullName, secondRef.prNumber, secondCommentId);
    probe.skippedUnclassified();
    expect(logger.debug).toHaveBeenCalledWith(
      { fn: 'DirectCommentCheckProbe.skippedUnclassified', repo: secondRef.repoFullName, pr: secondRef.prNumber, commentId: secondCommentId },
      'Skipping comment with unknown classification',
    );
  });

  it('throws when a comment-scoped method is called without a bound comment', () => {
    const probe = createProbe();
    expect(() => probe.skippedUnclassified()).toThrow(TypeError);
  });

  it('throws when a comment-scoped method is called after clearComment', () => {
    const ref = generateReviewRef();
    const probe = createProbe();
    probe.withComment(ref.repoFullName, ref.prNumber, getUniqueInt());
    probe.clearComment();
    expect(() => probe.skippedUnclassified()).toThrow(TypeError);
  });
});
