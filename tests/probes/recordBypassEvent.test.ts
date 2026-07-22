import type { EventRepository } from '../../src/db/index.js';
import { BypassReason } from '../../src/domain.js';
import { recordBypassEvent } from '../../src/probes/index.js';
import { createMockTx } from '../external-deps/couimet/prisma-testing/index.js';
import { generateObservationContextHydrationData, generateReviewRef } from '../helpers/index.js';

import { describe, expect, it, jest } from '@jest/globals';

describe('recordBypassEvent', () => {
  it('records a bypassed event with the correct shape for prMerged', async () => {
    const events = {
      record: jest.fn<any>(),
    } as unknown as EventRepository;
    const tx = createMockTx();
    const observation = generateObservationContextHydrationData();
    const ref = generateReviewRef();

    await recordBypassEvent({ events, tx, reason: BypassReason.prMerged, observation, repo_full_name: ref.repoFullName, pr_number: ref.prNumber });

    expect(events.record as jest.Mock<any>).toHaveBeenCalledWith(
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
  });

  it('records prClosedWithoutMerge with the correct reason', async () => {
    const events = {
      record: jest.fn<any>(),
    } as unknown as EventRepository;
    const tx = createMockTx();
    const observation = generateObservationContextHydrationData();
    const ref = generateReviewRef();

    await recordBypassEvent({ events, tx, reason: BypassReason.prClosedWithoutMerge, observation, repo_full_name: ref.repoFullName, pr_number: ref.prNumber });

    expect(events.record as jest.Mock<any>).toHaveBeenCalledWith(
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
  });
});
