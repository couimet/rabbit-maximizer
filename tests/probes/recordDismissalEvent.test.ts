import { DismissalReason } from '../../src/domain.js';
import { recordDismissalEvent } from '../../src/probes/index.js';
import { createMockTx } from '../external-deps/couimet/prisma-testing/index.js';
import { createMockEventRepo, generateObservationContextHydrationData, generateReviewRef } from '../helpers/index.js';

import { beforeEach, describe, expect, it } from '@jest/globals';

describe('recordDismissalEvent', () => {
  let events: ReturnType<typeof createMockEventRepo>;

  beforeEach(() => {
    events = createMockEventRepo();
  });

  it('records a dismissed event with the correct shape for prMerged', async () => {
    const tx = createMockTx();
    const observation = generateObservationContextHydrationData();
    const ref = generateReviewRef();

    await recordDismissalEvent({ events, tx, reason: DismissalReason.prMerged, observation, repo_full_name: ref.repoFullName, pr_number: ref.prNumber });

    expect(events.record).toHaveBeenCalledWith(
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
  });

  it('records prClosedWithoutMerge with the correct reason', async () => {
    const tx = createMockTx();
    const observation = generateObservationContextHydrationData();
    const ref = generateReviewRef();

    await recordDismissalEvent({
      events,
      tx,
      reason: DismissalReason.prClosedWithoutMerge,
      observation,
      repo_full_name: ref.repoFullName,
      pr_number: ref.prNumber,
    });

    expect(events.record).toHaveBeenCalledWith(
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
  });
});
