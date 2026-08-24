import { ExecutionContext } from '../../src/external-deps/couimet/execution-context/src/index.js';
import { PrunerProbe } from '../../src/probes/index.js';
import { createMockTx } from '../external-deps/couimet/prisma-testing/index.js';
import { createMockEventRepo, generateEventTraceContext, generateQueueItemHydrationData, generateReviewRef } from '../helpers/index.js';

import { createMockLogger } from '@couimet/logger-contract-testing';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

describe('PrunerProbe', () => {
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

  const createProbe = () => new PrunerProbe(events, logger);

  describe('noItemsToPrune', () => {
    it('logs info when no items to prune', () => {
      const probe = createProbe();
      probe.noItemsToPrune();
      expect(logger.info).toHaveBeenCalledWith({ fn: 'PrunerProbe.noItemsToPrune' }, 'No items to prune');
    });
  });

  describe('prMerged', () => {
    it('records dismissed event and logs', async () => {
      const ref = generateReviewRef();
      const item = generateQueueItemHydrationData({ repo_full_name: ref.repoFullName, pr_number: ref.prNumber });
      const tx = createMockTx();
      const probe = createProbe();
      probe.withItem(item);
      await runInContext(() => probe.prMerged(tx));
      expect(events.record as jest.Mock<any>).toHaveBeenCalledWith(
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
      expect(logger.info).toHaveBeenCalledWith(
        { fn: 'PrunerProbe.prMerged', repo: ref.repoFullName, pr: ref.prNumber, queueId: item.id },
        'Merged before retrigger; marked reviewed',
      );
    });
  });

  describe('prClosedWithoutMerge', () => {
    it('records dismissed event and logs', async () => {
      const ref = generateReviewRef();
      const item = generateQueueItemHydrationData({ repo_full_name: ref.repoFullName, pr_number: ref.prNumber });
      const tx = createMockTx();
      const probe = createProbe();
      probe.withItem(item);
      await runInContext(() => probe.prClosedWithoutMerge(tx));
      expect(events.record as jest.Mock<any>).toHaveBeenCalledWith(
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
      expect(logger.info).toHaveBeenCalledWith(
        { fn: 'PrunerProbe.prClosedWithoutMerge', repo: ref.repoFullName, pr: ref.prNumber, queueId: item.id },
        'PR closed before retrigger; marked failed',
      );
    });
  });

  describe('caughtError', () => {
    it('logs warn with item context and error', () => {
      const ref = generateReviewRef();
      const item = generateQueueItemHydrationData({ repo_full_name: ref.repoFullName, pr_number: ref.prNumber });
      const tickError = new Error('prune failure');
      const probe = createProbe();
      probe.withItem(item);
      probe.caughtError(tickError);
      expect(logger.warn).toHaveBeenCalledWith(
        { fn: 'PrunerProbe.caughtError', repo: ref.repoFullName, pr: ref.prNumber, queueId: item.id, error: tickError },
        'Failed to prune item; continuing',
      );
    });
  });
});
