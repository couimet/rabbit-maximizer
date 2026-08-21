import type { EventRepository } from '../../src/db/index.js';
import { CodeRabbitCommentType } from '../../src/domain.js';
import { DetectedProbe } from '../../src/probes/index.js';
import type { EventLogEntry } from '../../src/types/index.js';
import { createMockTx } from '../external-deps/couimet/prisma-testing/index.js';
import { generateObservationContextHydrationData, generateReviewRef } from '../helpers/index.js';

import { getUniqueDate, getUniqueInt, getUniqueString, getUuid } from '@couimet/dynamic-testing';
import { createMockLogger } from '@couimet/logger-contract-testing';
import { describe, expect, it, jest } from '@jest/globals';

const makeEventRepository = (entry: EventLogEntry): { eventRepository: EventRepository; record: jest.Mock<any> } => {
  const record = jest.fn<any>().mockResolvedValue(entry);
  const eventRepository = { record, listForPr: jest.fn<any>() } as unknown as EventRepository;
  return { eventRepository, record };
};

describe('DetectedProbe', () => {
  it('logs intent and records a detected event', async () => {
    const ref = generateReviewRef();
    const observation = generateObservationContextHydrationData();
    const sourceTs = getUniqueDate();
    const sourceCommentUrl = getUniqueString({ prefix: 'https://gh/c/' });
    const entryUuid = getUuid();
    const tx = createMockTx();

    const entry = { uuid: entryUuid } as unknown as EventLogEntry;
    const { eventRepository, record } = makeEventRepository(entry);
    const logger = createMockLogger();

    const probe = new DetectedProbe(
      {
        repo_full_name: ref.repoFullName,
        pr_number: ref.prNumber,
        source_ts: sourceTs,
        source_comment_url: sourceCommentUrl,
        coderabbit_run_id: undefined,
      },
      eventRepository,
      observation,
      logger,
    );

    await probe.detected();
    expect(logger.debug).toHaveBeenCalledWith({ fn: 'DetectedProbe', repo: ref.repoFullName, pr: ref.prNumber }, 'Review-limit comment detected');

    const result = await probe.enqueued(tx);

    expect(record).toHaveBeenCalledWith(
      {
        type: 'detected',
        repo_full_name: ref.repoFullName,
        pr_number: ref.prNumber,
        correlation_id: observation.correlationId,
        request_id: observation.requestId,
        version: observation.version,
        payload: { source_ts: sourceTs, source_comment_url: sourceCommentUrl },
      },
      tx,
    );
    expect(result).toBe(entry);
    expect(logger.info).toHaveBeenCalledWith(
      { fn: 'DetectedProbe', repo: ref.repoFullName, pr: ref.prNumber, eventUuid: entryUuid },
      'Review-limit comment detected and enqueued',
    );
  });

  it('forwards the transaction client to the repository', async () => {
    const ref = generateReviewRef();
    const observation = generateObservationContextHydrationData({ requestId: undefined, version: getUniqueString() });
    const entryUuid = getUuid();
    const entry = { uuid: entryUuid } as unknown as EventLogEntry;
    const { eventRepository, record } = makeEventRepository(entry);
    const logger = createMockLogger();
    const tx = createMockTx();

    const sourceTs = getUniqueDate();
    const sourceCommentUrl = getUniqueString({ prefix: 'https://gh/c/' });

    const probe = new DetectedProbe(
      {
        repo_full_name: ref.repoFullName,
        pr_number: ref.prNumber,
        source_ts: sourceTs,
        source_comment_url: sourceCommentUrl,
        coderabbit_run_id: undefined,
      },
      eventRepository,
      observation,
      logger,
    );
    await probe.enqueued(tx);

    expect(record).toHaveBeenCalledWith(
      {
        type: 'detected',
        repo_full_name: ref.repoFullName,
        pr_number: ref.prNumber,
        correlation_id: observation.correlationId,
        request_id: undefined,
        version: observation.version,
        payload: { source_ts: sourceTs, source_comment_url: sourceCommentUrl },
      },
      tx,
    );
    expect(logger.info).toHaveBeenCalledWith(
      { fn: 'DetectedProbe', repo: ref.repoFullName, pr: ref.prNumber, eventUuid: entryUuid },
      'Review-limit comment detected and enqueued',
    );
  });

  it('records a dismissed event for merged PRs', async () => {
    const ref = generateReviewRef();
    const observation = generateObservationContextHydrationData();
    const entryUuid = getUuid();
    const tx = createMockTx();

    const entry = { uuid: entryUuid } as unknown as EventLogEntry;
    const { eventRepository, record } = makeEventRepository(entry);
    const logger = createMockLogger();

    const probe = new DetectedProbe(
      {
        repo_full_name: ref.repoFullName,
        pr_number: ref.prNumber,
        source_ts: getUniqueDate(),
        source_comment_url: getUniqueString({ prefix: 'https://gh/c/' }),
        coderabbit_run_id: undefined,
      },
      eventRepository,
      observation,
      logger,
    );

    const result = await probe.prMerged(tx);

    expect(record).toHaveBeenCalledWith(
      {
        type: 'dismissed',
        repo_full_name: ref.repoFullName,
        pr_number: ref.prNumber,
        correlation_id: observation.correlationId,
        request_id: observation.requestId,
        version: observation.version,
        payload: { reason: 'prMerged' },
      },
      tx,
    );
    expect(result).toBe(entry);
    expect(logger.info).toHaveBeenCalledWith(
      { fn: 'DetectedProbe', repo: ref.repoFullName, pr: ref.prNumber, eventUuid: entryUuid },
      'Review-limit comment dismissed: PR already merged',
    );
  });

  it('records a dismissed event for closed-without-merge PRs', async () => {
    const ref = generateReviewRef();
    const observation = generateObservationContextHydrationData();
    const entryUuid = getUuid();
    const tx = createMockTx();

    const entry = { uuid: entryUuid } as unknown as EventLogEntry;
    const { eventRepository, record } = makeEventRepository(entry);
    const logger = createMockLogger();

    const probe = new DetectedProbe(
      {
        repo_full_name: ref.repoFullName,
        pr_number: ref.prNumber,
        source_ts: getUniqueDate(),
        source_comment_url: getUniqueString({ prefix: 'https://gh/c/' }),
        coderabbit_run_id: undefined,
      },
      eventRepository,
      observation,
      logger,
    );

    const result = await probe.prClosedWithoutMerge(tx);

    expect(record).toHaveBeenCalledWith(
      {
        type: 'dismissed',
        repo_full_name: ref.repoFullName,
        pr_number: ref.prNumber,
        correlation_id: observation.correlationId,
        request_id: observation.requestId,
        version: observation.version,
        payload: { reason: 'prClosedWithoutMerge' },
      },
      tx,
    );
    expect(result).toBe(entry);
    expect(logger.info).toHaveBeenCalledWith(
      { fn: 'DetectedProbe', repo: ref.repoFullName, pr: ref.prNumber, eventUuid: entryUuid },
      'Review-limit comment dismissed: PR closed without merge',
    );
  });

  it('records a dismissed event for unregistered PRs', async () => {
    const ref = generateReviewRef();
    const observation = generateObservationContextHydrationData();
    const entryUuid = getUuid();
    const tx = createMockTx();

    const entry = { uuid: entryUuid } as unknown as EventLogEntry;
    const { eventRepository, record } = makeEventRepository(entry);
    const logger = createMockLogger();

    const probe = new DetectedProbe(
      {
        repo_full_name: ref.repoFullName,
        pr_number: ref.prNumber,
        source_ts: getUniqueDate(),
        source_comment_url: getUniqueString({ prefix: 'https://gh/c/' }),
        coderabbit_run_id: undefined,
      },
      eventRepository,
      observation,
      logger,
    );

    const result = await probe.prNotRegistered(tx);

    expect(record).toHaveBeenCalledWith(
      {
        type: 'dismissed',
        repo_full_name: ref.repoFullName,
        pr_number: ref.prNumber,
        correlation_id: observation.correlationId,
        request_id: observation.requestId,
        version: observation.version,
        payload: { reason: 'prNotRegistered' },
      },
      tx,
    );
    expect(result).toBe(entry);
    expect(logger.info).toHaveBeenCalledWith(
      { fn: 'DetectedProbe', repo: ref.repoFullName, pr: ref.prNumber, eventUuid: entryUuid },
      'Review-limit comment dismissed: PR not yet registered by scanner',
    );
  });

  it('logs when the queue item already exists', () => {
    const ref = generateReviewRef();
    const observation = generateObservationContextHydrationData();
    const logger = createMockLogger();

    const probe = new DetectedProbe(
      {
        repo_full_name: ref.repoFullName,
        pr_number: ref.prNumber,
        source_ts: getUniqueDate(),
        source_comment_url: getUniqueString({ prefix: 'https://gh/c/' }),
        coderabbit_run_id: undefined,
      },
      {} as EventRepository,
      observation,
      logger,
    );

    probe.alreadyQueued();

    expect(logger.info).toHaveBeenCalledWith(
      { fn: 'DetectedProbe', repo: ref.repoFullName, pr: ref.prNumber },
      'Review-limit comment already queued; skipping',
    );
  });

  it('records a coderabbit_review_skipped event with source_ts, comment_url, and coderabbit_run_id', async () => {
    const ref = generateReviewRef();
    const observation = generateObservationContextHydrationData();
    const sourceTs = getUniqueDate();
    const sourceCommentUrl = getUniqueString({ prefix: 'https://gh/c/' });
    const coderabbitRunId = getUuid();
    const entryUuid = getUuid();
    const tx = createMockTx();

    const entry = { uuid: entryUuid } as unknown as EventLogEntry;
    const { eventRepository, record } = makeEventRepository(entry);
    const logger = createMockLogger();

    const probe = new DetectedProbe(
      {
        repo_full_name: ref.repoFullName,
        pr_number: ref.prNumber,
        source_ts: sourceTs,
        source_comment_url: sourceCommentUrl,
        coderabbit_run_id: coderabbitRunId,
      },
      eventRepository,
      observation,
      logger,
    );

    const result = await probe.skipped(tx);

    expect(record).toHaveBeenCalledWith(
      {
        type: 'coderabbit_review_skipped',
        repo_full_name: ref.repoFullName,
        pr_number: ref.prNumber,
        correlation_id: observation.correlationId,
        request_id: observation.requestId,
        version: observation.version,
        payload: {
          source_ts: sourceTs,
          comment_url: sourceCommentUrl,
          skip_reason: 'CodeRabbit explicitly skipped this review',
          coderabbit_run_id: coderabbitRunId,
        },
      },
      tx,
    );
    expect(result).toBe(entry);
    expect(logger.info).toHaveBeenCalledWith(
      { fn: 'DetectedProbe', repo: ref.repoFullName, pr: ref.prNumber, eventUuid: entryUuid, coderabbit_run_id: coderabbitRunId },
      'CodeRabbit skip comment encountered',
    );
  });

  it('records a detected event with coderabbit_run_id as evidence', async () => {
    const ref = generateReviewRef();
    const observation = generateObservationContextHydrationData();
    const sourceTs = getUniqueDate();
    const sourceCommentUrl = getUniqueString({ prefix: 'https://gh/c/' });
    const coderabbitRunId = getUuid();
    const entryUuid = getUuid();
    const tx = createMockTx();

    const entry = { uuid: entryUuid } as unknown as EventLogEntry;
    const { eventRepository, record } = makeEventRepository(entry);
    const logger = createMockLogger();

    const probe = new DetectedProbe(
      {
        repo_full_name: ref.repoFullName,
        pr_number: ref.prNumber,
        source_ts: sourceTs,
        source_comment_url: sourceCommentUrl,
        coderabbit_run_id: coderabbitRunId,
      },
      eventRepository,
      observation,
      logger,
    );

    await probe.enqueued(tx);

    expect(record).toHaveBeenCalledWith(
      {
        type: 'detected',
        repo_full_name: ref.repoFullName,
        pr_number: ref.prNumber,
        correlation_id: observation.correlationId,
        request_id: observation.requestId,
        version: observation.version,
        payload: { source_ts: sourceTs, source_comment_url: sourceCommentUrl, coderabbit_run_id: coderabbitRunId },
      },
      tx,
    );
    expect(logger.info).toHaveBeenCalledWith(
      { fn: 'DetectedProbe', repo: ref.repoFullName, pr: ref.prNumber, eventUuid: entryUuid, coderabbit_run_id: coderabbitRunId },
      'Review-limit comment detected and enqueued',
    );
  });

  it('records a coderabbit_review_approved event with coderabbit_run_id as evidence', async () => {
    const ref = generateReviewRef();
    const observation = generateObservationContextHydrationData();
    const sourceTs = getUniqueDate();
    const sourceCommentUrl = getUniqueString({ prefix: 'https://gh/c/' });
    const coderabbitRunId = getUuid();
    const entryUuid = getUuid();
    const tx = createMockTx();

    const entry = { uuid: entryUuid } as unknown as EventLogEntry;
    const { eventRepository, record } = makeEventRepository(entry);
    const logger = createMockLogger();

    const probe = new DetectedProbe(
      {
        repo_full_name: ref.repoFullName,
        pr_number: ref.prNumber,
        source_ts: sourceTs,
        source_comment_url: sourceCommentUrl,
        coderabbit_run_id: coderabbitRunId,
      },
      eventRepository,
      observation,
      logger,
    );

    await probe.verdictResolved(tx, CodeRabbitCommentType.review_approved);

    expect(record).toHaveBeenCalledWith(
      {
        type: 'coderabbit_review_approved',
        repo_full_name: ref.repoFullName,
        pr_number: ref.prNumber,
        correlation_id: observation.correlationId,
        request_id: observation.requestId,
        version: observation.version,
        payload: { coderabbit_comment_url: sourceCommentUrl, source_ts: sourceTs, verdict_state: 'review_approved', coderabbit_run_id: coderabbitRunId },
      },
      tx,
    );
    expect(logger.info).toHaveBeenCalledWith(
      { fn: 'DetectedProbe', repo: ref.repoFullName, pr: ref.prNumber, eventUuid: entryUuid, coderabbit_run_id: coderabbitRunId },
      'CodeRabbit review verdict detected; skipping enqueue',
    );
  });

  it('logs when a skipped comment was already recorded', () => {
    const ref = generateReviewRef();
    const observation = generateObservationContextHydrationData();
    const logger = createMockLogger();

    const probe = new DetectedProbe(
      {
        repo_full_name: ref.repoFullName,
        pr_number: ref.prNumber,
        source_ts: getUniqueDate(),
        source_comment_url: getUniqueString({ prefix: 'https://gh/c/' }),
        coderabbit_run_id: undefined,
      },
      {} as EventRepository,
      observation,
      logger,
    );

    probe.alreadySkipped('coderabbit_skipped');

    expect(logger.warn).toHaveBeenCalledWith(
      { fn: 'DetectedProbe', repo: ref.repoFullName, pr: ref.prNumber, existingStatus: 'coderabbit_skipped' },
      'Skipped comment already recorded; skipping',
    );
  });

  it('logs when a reviewed comment was already recorded', () => {
    const ref = generateReviewRef();
    const observation = generateObservationContextHydrationData();
    const logger = createMockLogger();

    const probe = new DetectedProbe(
      {
        repo_full_name: ref.repoFullName,
        pr_number: ref.prNumber,
        source_ts: getUniqueDate(),
        source_comment_url: getUniqueString({ prefix: 'https://gh/c/' }),
        coderabbit_run_id: undefined,
      },
      {} as EventRepository,
      observation,
      logger,
    );

    const commentId = getUniqueInt();
    const commentUrl = getUniqueString({ prefix: 'https://gh/c/' });
    const comment = { comment_id: commentId, url: commentUrl };
    probe.alreadyReviewed(comment);

    expect(logger.info).toHaveBeenCalledWith(
      { fn: 'DetectedProbe', repo: ref.repoFullName, pr: ref.prNumber, commentId, commentUrl },
      'PR already reviewed by CodeRabbit; skipping enqueue',
    );
  });

  it('records a coderabbit_review_approved event and logs when verdict is approved', async () => {
    const ref = generateReviewRef();
    const observation = generateObservationContextHydrationData();
    const sourceTs = getUniqueDate();
    const sourceCommentUrl = getUniqueString({ prefix: 'https://gh/c/' });
    const entryUuid = getUuid();
    const tx = createMockTx();

    const entry = { uuid: entryUuid } as unknown as EventLogEntry;
    const { eventRepository, record } = makeEventRepository(entry);
    const logger = createMockLogger();

    const probe = new DetectedProbe(
      {
        repo_full_name: ref.repoFullName,
        pr_number: ref.prNumber,
        source_ts: sourceTs,
        source_comment_url: sourceCommentUrl,
        coderabbit_run_id: undefined,
      },
      eventRepository,
      observation,
      logger,
    );

    const result = await probe.verdictResolved(tx, CodeRabbitCommentType.review_approved);

    expect(record).toHaveBeenCalledWith(
      {
        type: 'coderabbit_review_approved',
        repo_full_name: ref.repoFullName,
        pr_number: ref.prNumber,
        correlation_id: observation.correlationId,
        request_id: observation.requestId,
        version: observation.version,
        payload: { coderabbit_comment_url: sourceCommentUrl, source_ts: sourceTs, verdict_state: 'review_approved' },
      },
      tx,
    );
    expect(result).toBe(entry);
    expect(logger.info).toHaveBeenCalledWith(
      { fn: 'DetectedProbe', repo: ref.repoFullName, pr: ref.prNumber, eventUuid: entryUuid },
      'CodeRabbit review verdict detected; skipping enqueue',
    );
  });

  it('records a coderabbit_review_changes_suggested event when verdict is changes requested', async () => {
    const ref = generateReviewRef();
    const observation = generateObservationContextHydrationData();
    const sourceTs = getUniqueDate();
    const sourceCommentUrl = getUniqueString({ prefix: 'https://gh/c/' });
    const entryUuid = getUuid();
    const tx = createMockTx();

    const entry = { uuid: entryUuid } as unknown as EventLogEntry;
    const { eventRepository, record } = makeEventRepository(entry);
    const logger = createMockLogger();

    const probe = new DetectedProbe(
      {
        repo_full_name: ref.repoFullName,
        pr_number: ref.prNumber,
        source_ts: sourceTs,
        source_comment_url: sourceCommentUrl,
        coderabbit_run_id: undefined,
      },
      eventRepository,
      observation,
      logger,
    );

    const result = await probe.verdictResolved(tx, CodeRabbitCommentType.review_changes_suggested);

    expect(record).toHaveBeenCalledWith(
      {
        type: 'coderabbit_review_changes_suggested',
        repo_full_name: ref.repoFullName,
        pr_number: ref.prNumber,
        correlation_id: observation.correlationId,
        request_id: observation.requestId,
        version: observation.version,
        payload: { coderabbit_comment_url: sourceCommentUrl, source_ts: sourceTs, verdict_state: 'review_changes_suggested' },
      },
      tx,
    );
    expect(result).toBe(entry);
    expect(logger.info).toHaveBeenCalledWith(
      { fn: 'DetectedProbe', repo: ref.repoFullName, pr: ref.prNumber, eventUuid: entryUuid },
      'CodeRabbit review verdict detected; skipping enqueue',
    );
  });
});
