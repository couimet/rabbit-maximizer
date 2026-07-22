import type { EventRepository } from '../../src/db/index.js';
import { DetectedProbe } from '../../src/probes/index.js';
import type { EventLogEntry } from '../../src/types/index.js';
import { createMockTx } from '../external-deps/couimet/prisma-testing/index.js';
import { generateObservationContextHydrationData, generateReviewRef } from '../helpers/index.js';

import { getUniqueDate, getUniqueString, getUuid } from '@couimet/dynamic-testing';
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
      { repo_full_name: ref.repoFullName, pr_number: ref.prNumber, source_ts: sourceTs, source_comment_url: sourceCommentUrl },
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
      { repo_full_name: ref.repoFullName, pr_number: ref.prNumber, source_ts: sourceTs, source_comment_url: sourceCommentUrl },
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

  it('records a bypassed event for merged PRs', async () => {
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
      },
      eventRepository,
      observation,
      logger,
    );

    const result = await probe.prMerged(tx);

    expect(record).toHaveBeenCalledWith(
      {
        type: 'bypassed',
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
      'Review-limit comment bypassed: PR already merged',
    );
  });

  it('records a bypassed event for closed-without-merge PRs', async () => {
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
      },
      eventRepository,
      observation,
      logger,
    );

    const result = await probe.prClosedWithoutMerge(tx);

    expect(record).toHaveBeenCalledWith(
      {
        type: 'bypassed',
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
      'Review-limit comment bypassed: PR closed without merge',
    );
  });

  it('records a bypassed event for unregistered PRs', async () => {
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
      },
      eventRepository,
      observation,
      logger,
    );

    const result = await probe.prNotRegistered(tx);

    expect(record).toHaveBeenCalledWith(
      {
        type: 'bypassed',
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
      'Review-limit comment bypassed: PR not yet registered by scanner',
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

  it('records a coderabbit_review_skipped event with source_ts and comment_url', async () => {
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
      { repo_full_name: ref.repoFullName, pr_number: ref.prNumber, source_ts: sourceTs, source_comment_url: sourceCommentUrl },
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
        payload: { source_ts: sourceTs, comment_url: sourceCommentUrl, skip_reason: 'CodeRabbit explicitly skipped this review' },
      },
      tx,
    );
    expect(result).toBe(entry);
    expect(logger.info).toHaveBeenCalledWith(
      { fn: 'DetectedProbe', repo: ref.repoFullName, pr: ref.prNumber, eventUuid: entryUuid },
      'CodeRabbit skipped review event recorded',
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
});
