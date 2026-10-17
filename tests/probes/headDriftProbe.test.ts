import { IgnoreRuleField } from '../../src/domain.js';
import { HeadDriftProbe } from '../../src/probes/index.js';
import type { IgnoreRuleMatch, UnreviewedHeadPR } from '../../src/types/index.js';
import { withTestExecutionContext } from '../external-deps/couimet/execution-context-testing/index.js';
import { createMockEventRepo, generateEventTraceContext } from '../helpers/index.js';

import { getUniqueDate, getUniqueInt, getUniqueString } from '@couimet/dynamic-testing';
import { createMockLogger } from '@couimet/logger-contract-testing';
import { beforeEach, describe, expect, it } from '@jest/globals';
import type { Prisma } from '@prisma/client';

describe('HeadDriftProbe', () => {
  let events: ReturnType<typeof createMockEventRepo>;
  let logger: ReturnType<typeof createMockLogger>;
  let eventTrace: { correlationId: string; requestId: string; version: string };
  let candidate: UnreviewedHeadPR;
  let tx: Prisma.TransactionClient;

  const runInContext = <T>(fn: () => Promise<T>): Promise<T> =>
    withTestExecutionContext({ correlationId: eventTrace.correlationId, requestId: eventTrace.requestId, attributes: { version: eventTrace.version } }, fn);

  beforeEach(() => {
    eventTrace = generateEventTraceContext();
    events = createMockEventRepo();
    logger = createMockLogger();
    tx = { marker: getUniqueString() } as unknown as Prisma.TransactionClient;
    candidate = {
      id: getUniqueInt(),
      repoFullName: `${getUniqueString()}/${getUniqueString()}`,
      prNumber: getUniqueInt(),
      title: getUniqueString(),
      authorLogin: getUniqueString(),
      headSha: getUniqueString({ prefix: 'head-' }),
      headCommittedAt: getUniqueDate(),
      reviewedHeadSha: getUniqueString({ prefix: 'reviewed-' }),
    };
  });

  const createProbe = () => {
    const probe = new HeadDriftProbe(events, logger);
    probe.withCandidate(candidate);
    return probe;
  };

  it('logs a debug when no candidate carries an unreviewed head', () => {
    const probe = createProbe();

    probe.noDriftFound();

    expect(logger.debug).toHaveBeenCalledWith({ fn: 'HeadDriftProbe.noDriftFound' }, 'No pull request carries an unreviewed head');
  });

  it('logs an info when a candidate matches an ignore rule', () => {
    const probe = createProbe();
    const match: IgnoreRuleMatch = { field: IgnoreRuleField.author, pattern: getUniqueString() };

    probe.excluded(match);

    expect(logger.info).toHaveBeenCalledWith(
      {
        fn: 'HeadDriftProbe.excluded',
        repo: candidate.repoFullName,
        pr: candidate.prNumber,
        field: 'author',
        pattern: match.pattern,
      },
      'Head-drift candidate matches an ignore rule; left it out of the queue',
    );
  });

  it('logs an info when a completed review already covers the head', () => {
    const probe = createProbe();
    const reviewUrl = getUniqueString({ prefix: 'https://gh/r/' });

    probe.headAlreadyReviewed(reviewUrl);

    expect(logger.info).toHaveBeenCalledWith(
      { fn: 'HeadDriftProbe.headAlreadyReviewed', repo: candidate.repoFullName, pr: candidate.prNumber, reviewUrl },
      'A completed review covers the head; recorded the review and enqueued nothing',
    );
  });

  it('logs an info when the head carries no completed review', () => {
    const probe = createProbe();

    probe.headDriftFound();

    expect(logger.info).toHaveBeenCalledWith(
      {
        fn: 'HeadDriftProbe.headDriftFound',
        repo: candidate.repoFullName,
        pr: candidate.prNumber,
        headSha: candidate.headSha,
        reviewedHeadSha: candidate.reviewedHeadSha,
      },
      'No completed review covers the head; enqueuing a pending item',
    );
  });

  it('records a head_drift_recovered event and logs the outcome', async () => {
    const probe = createProbe();

    await runInContext(() => probe.recovered(tx));

    expect(events.record).toHaveBeenCalledWith(
      {
        type: 'head_drift_recovered',
        repo_full_name: candidate.repoFullName,
        pr_number: candidate.prNumber,
        correlation_id: eventTrace.correlationId,
        request_id: eventTrace.requestId,
        version: eventTrace.version,
        payload: { head_sha: candidate.headSha, reviewed_head_sha: candidate.reviewedHeadSha },
      },
      tx,
    );
    expect(logger.info).toHaveBeenCalledWith(
      {
        fn: 'HeadDriftProbe.recovered',
        repo: candidate.repoFullName,
        pr: candidate.prNumber,
        headSha: candidate.headSha,
        reviewedHeadSha: candidate.reviewedHeadSha,
      },
      'Enqueued a pending item for a head that no review covers',
    );
  });

  it('records no reviewed head in the payload when the candidate carries none', async () => {
    candidate = { ...candidate, reviewedHeadSha: null };
    const probe = createProbe();

    await runInContext(() => probe.recovered(tx));

    expect(events.record).toHaveBeenCalledWith(
      {
        type: 'head_drift_recovered',
        repo_full_name: candidate.repoFullName,
        pr_number: candidate.prNumber,
        correlation_id: eventTrace.correlationId,
        request_id: eventTrace.requestId,
        version: eventTrace.version,
        payload: { head_sha: candidate.headSha, reviewed_head_sha: undefined },
      },
      tx,
    );
  });
});
