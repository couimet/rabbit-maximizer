import type { EventRepository } from '../../src/db/eventRepository.js';
import type { ObservationContext } from '../../src/observability/observationContext.js';
import { recordBypassEvent } from '../../src/probes/recordBypassEvent.js';
import { BypassReason } from '../../src/types/index.js';

import { getUniqueInt, getUniqueString } from '@couimet/dynamic-testing';
import { describe, expect, it, jest } from '@jest/globals';
import type { Prisma } from '@prisma/client';

const makeTx = (): Prisma.TransactionClient => ({}) as Prisma.TransactionClient;

describe('recordBypassEvent', () => {
  it('records a bypassed event with the correct shape for prMerged', async () => {
    const events = {
      record: jest.fn<any>(),
    } as unknown as EventRepository;
    const tx = makeTx();
    const observation: ObservationContext = {
      correlationId: getUniqueString({ prefix: 'corr-' }),
      requestId: getUniqueString({ prefix: 'req-' }),
      version: '1.0.0',
    };
    const repo = getUniqueString({ prefix: 'owner/' });
    const pr = getUniqueInt();

    await recordBypassEvent({ events, tx, reason: BypassReason.prMerged, observation, repo_full_name: repo, pr_number: pr });

    expect(events.record as jest.Mock<any>).toHaveBeenCalledWith(
      {
        type: 'bypassed',
        repo_full_name: repo,
        pr_number: pr,
        correlation_id: observation.correlationId,
        request_id: observation.requestId,
        version: observation.version,
        payload: { reason: 'prMerged' },
      },
      tx,
    );
  });

  it('records prClosedWithoutMerge with the correct reason', async () => {
    const events = {
      record: jest.fn<any>(),
    } as unknown as EventRepository;
    const tx = makeTx();
    const observation: ObservationContext = {
      correlationId: getUniqueString({ prefix: 'corr-' }),
      requestId: getUniqueString({ prefix: 'req-' }),
      version: '1.0.0',
    };
    const repo = getUniqueString({ prefix: 'owner/' });
    const pr = getUniqueInt();

    await recordBypassEvent({ events, tx, reason: BypassReason.prClosedWithoutMerge, observation, repo_full_name: repo, pr_number: pr });

    expect(events.record as jest.Mock<any>).toHaveBeenCalledWith(
      {
        type: 'bypassed',
        repo_full_name: repo,
        pr_number: pr,
        correlation_id: observation.correlationId,
        request_id: observation.requestId,
        version: observation.version,
        payload: { reason: 'prClosedWithoutMerge' },
      },
      tx,
    );
  });
});
