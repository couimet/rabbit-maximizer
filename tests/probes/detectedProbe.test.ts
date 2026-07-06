import type { EventRepository } from '../../src/db/eventRepository.js';
import type { ObservationContext } from '../../src/observability/observationContext.js';
import { DetectedProbe } from '../../src/probes/DetectedProbe.js';
import type { EventLogEntry } from '../../src/types/index.js';
import { createMockLogger, makeUniqueRepoName } from '../helpers/index.js';

import { getUniqueDate, getUniqueInt, getUniqueString } from '@couimet/dynamic-testing';
import { describe, expect, it, jest } from '@jest/globals';
import type { Prisma } from '@prisma/client';

const makeTx = (): Prisma.TransactionClient => ({}) as Prisma.TransactionClient;

const makeEventRepository = (entry: EventLogEntry): { eventRepository: EventRepository; record: jest.Mock<any> } => {
  const record = jest.fn<any>().mockResolvedValue(entry);
  const eventRepository = { record, listForPr: jest.fn<any>() } as unknown as EventRepository;
  return { eventRepository, record };
};

describe('DetectedProbe', () => {
  it('logs intent and records a detected event', async () => {
    const { fullName: repo } = makeUniqueRepoName();
    const pr = getUniqueInt();
    const correlationId = getUniqueString({ prefix: 'corr-' });
    const requestId = getUniqueString({ prefix: 'req-' });
    const version = getUniqueString({ prefix: 'v' });
    const sourceTs = getUniqueDate();
    const sourceCommentUrl = getUniqueString({ prefix: 'https://gh/c/' });
    const entryUuid = getUniqueString({ prefix: 'uuid-' });
    const tx = makeTx();

    const entry = { uuid: entryUuid } as unknown as EventLogEntry;
    const { eventRepository, record } = makeEventRepository(entry);
    const logger = createMockLogger();
    const observation: ObservationContext = { correlationId, requestId, version };

    const probe = new DetectedProbe(
      { repo_full_name: repo, pr_number: pr, source_ts: sourceTs, source_comment_url: sourceCommentUrl },
      eventRepository,
      observation,
      logger,
    );

    await probe.processStarted();
    expect(logger.debug).toHaveBeenCalledWith({ fn: 'DetectedProbe', repo, pr }, 'Review-limit comment detected');

    const result = await probe.processCompleted(tx);

    expect(record).toHaveBeenCalledWith(
      {
        type: 'detected',
        repo_full_name: repo,
        pr_number: pr,
        correlation_id: correlationId,
        request_id: requestId,
        version,
        payload: { source_ts: sourceTs, source_comment_url: sourceCommentUrl },
      },
      tx,
    );
    expect(result).toBe(entry);
    expect(logger.info).toHaveBeenCalledWith({ fn: 'DetectedProbe', repo, pr, eventUuid: entryUuid }, 'Review-limit comment detected and enqueued');
  });

  it('forwards the transaction client to the repository', async () => {
    const { fullName: repo } = makeUniqueRepoName();
    const pr = getUniqueInt();
    const observation: ObservationContext = { correlationId: getUniqueString(), version: getUniqueString() };
    const entryUuid = getUniqueString({ prefix: 'uuid-' });
    const entry = { uuid: entryUuid } as unknown as EventLogEntry;
    const { eventRepository, record } = makeEventRepository(entry);
    const logger = createMockLogger();
    const tx = makeTx();

    const probe = new DetectedProbe({ repo_full_name: repo, pr_number: pr }, eventRepository, observation, logger);
    await probe.processCompleted(tx);

    expect(record).toHaveBeenCalledWith(
      {
        type: 'detected',
        repo_full_name: repo,
        pr_number: pr,
        correlation_id: observation.correlationId,
        request_id: undefined,
        version: observation.version,
        payload: { source_ts: undefined, source_comment_url: undefined },
      },
      tx,
    );
    expect(logger.info).toHaveBeenCalledWith({ fn: 'DetectedProbe', repo, pr, eventUuid: entryUuid }, 'Review-limit comment detected and enqueued');
  });

  it('records a bypassed event for merged PRs', async () => {
    const { fullName: repo } = makeUniqueRepoName();
    const pr = getUniqueInt();
    const correlationId = getUniqueString({ prefix: 'corr-' });
    const requestId = getUniqueString({ prefix: 'req-' });
    const version = getUniqueString({ prefix: 'v' });
    const entryUuid = getUniqueString({ prefix: 'uuid-' });
    const tx = makeTx();

    const entry = { uuid: entryUuid } as unknown as EventLogEntry;
    const { eventRepository, record } = makeEventRepository(entry);
    const logger = createMockLogger();
    const observation: ObservationContext = { correlationId, requestId, version };

    const probe = new DetectedProbe({ repo_full_name: repo, pr_number: pr }, eventRepository, observation, logger);

    const result = await probe.processMerged(tx);

    expect(record).toHaveBeenCalledWith(
      {
        type: 'bypassed',
        repo_full_name: repo,
        pr_number: pr,
        correlation_id: correlationId,
        request_id: requestId,
        version,
        payload: { reason: 'prMerged' },
      },
      tx,
    );
    expect(result).toBe(entry);
    expect(logger.info).toHaveBeenCalledWith({ fn: 'DetectedProbe', repo, pr, eventUuid: entryUuid }, 'Review-limit comment bypassed: PR already merged');
  });

  it('records a bypassed event for closed-without-merge PRs', async () => {
    const { fullName: repo } = makeUniqueRepoName();
    const pr = getUniqueInt();
    const correlationId = getUniqueString({ prefix: 'corr-' });
    const requestId = getUniqueString({ prefix: 'req-' });
    const version = getUniqueString({ prefix: 'v' });
    const entryUuid = getUniqueString({ prefix: 'uuid-' });
    const tx = makeTx();

    const entry = { uuid: entryUuid } as unknown as EventLogEntry;
    const { eventRepository, record } = makeEventRepository(entry);
    const logger = createMockLogger();
    const observation: ObservationContext = { correlationId, requestId, version };

    const probe = new DetectedProbe({ repo_full_name: repo, pr_number: pr }, eventRepository, observation, logger);

    const result = await probe.processClosedWithoutMerge(tx);

    expect(record).toHaveBeenCalledWith(
      {
        type: 'bypassed',
        repo_full_name: repo,
        pr_number: pr,
        correlation_id: correlationId,
        request_id: requestId,
        version,
        payload: { reason: 'prClosedWithoutMerge' },
      },
      tx,
    );
    expect(result).toBe(entry);
    expect(logger.info).toHaveBeenCalledWith({ fn: 'DetectedProbe', repo, pr, eventUuid: entryUuid }, 'Review-limit comment bypassed: PR closed without merge');
  });

  it('logs when the queue item already exists', () => {
    const { fullName: repo } = makeUniqueRepoName();
    const pr = getUniqueInt();
    const observation: ObservationContext = { correlationId: getUniqueString(), version: getUniqueString() };
    const logger = createMockLogger();

    const probe = new DetectedProbe({ repo_full_name: repo, pr_number: pr }, {} as EventRepository, observation, logger);

    probe.processAlreadyQueued();

    expect(logger.info).toHaveBeenCalledWith({ fn: 'DetectedProbe', repo, pr }, 'Review-limit comment already queued; skipping');
  });
});
