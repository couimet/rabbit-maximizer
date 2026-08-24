import { DismissalReason } from '../../src/domain.js';
import { ExecutionContext } from '../../src/external-deps/couimet/execution-context/src/index.js';
import { recordDismissalEvent } from '../../src/probes/index.js';
import { createMockTx } from '../external-deps/couimet/prisma-testing/index.js';
import { createMockEventRepo, generateEventTraceContext, generateReviewRef } from '../helpers/index.js';

import { beforeEach, describe, expect, it } from '@jest/globals';

describe('recordDismissalEvent', () => {
  let events: ReturnType<typeof createMockEventRepo>;
  let eventTrace: { correlationId: string; requestId: string; version: string };

  const runInContext = <T>(fn: () => Promise<T>): Promise<T> =>
    ExecutionContext.run({ correlationId: eventTrace.correlationId, requestId: eventTrace.requestId, attributes: { version: eventTrace.version } }, fn);

  beforeEach(() => {
    eventTrace = generateEventTraceContext();
    events = createMockEventRepo();
  });

  it('records a dismissed event with the correct shape for prMerged', async () => {
    const tx = createMockTx();
    const ref = generateReviewRef();

    await runInContext(() => recordDismissalEvent({ events, tx, reason: DismissalReason.prMerged, repo_full_name: ref.repoFullName, pr_number: ref.prNumber }));

    expect(events.record).toHaveBeenCalledWith(
      {
        type: 'dismissed',
        repo_full_name: ref.repoFullName,
        pr_number: ref.prNumber,
        correlation_id: eventTrace.correlationId,
        request_id: eventTrace.requestId,
        version: eventTrace.version,
        payload: { reason: 'prMerged' },
      },
      tx,
    );
  });

  it('records prClosedWithoutMerge with the correct reason', async () => {
    const tx = createMockTx();
    const ref = generateReviewRef();

    await runInContext(() =>
      recordDismissalEvent({
        events,
        tx,
        reason: DismissalReason.prClosedWithoutMerge,
        repo_full_name: ref.repoFullName,
        pr_number: ref.prNumber,
      }),
    );

    expect(events.record).toHaveBeenCalledWith(
      {
        type: 'dismissed',
        repo_full_name: ref.repoFullName,
        pr_number: ref.prNumber,
        correlation_id: eventTrace.correlationId,
        request_id: eventTrace.requestId,
        version: eventTrace.version,
        payload: { reason: 'prClosedWithoutMerge' },
      },
      tx,
    );
  });
});
