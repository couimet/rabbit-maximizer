import { PrState } from '../../src/domain.js';
import { QueueItemEnricher } from '../../src/utils/QueueItemEnricher.js';
import { createMockPullRequestRepo, generateQueueItemHydrationData } from '../helpers/index.js';

import { getUniqueDate, getUniqueInt } from '@couimet/dynamic-testing';
import type { Logger } from '@couimet/logger-contract';
import { beforeEach, describe, expect, it } from '@jest/globals';

const { createMockLogger } = await import('@couimet/logger-contract-testing');

describe('QueueItemEnricher', () => {
  let pullRequests: ReturnType<typeof createMockPullRequestRepo>;
  let logger: Logger;
  let enricher: QueueItemEnricher;

  beforeEach(() => {
    pullRequests = createMockPullRequestRepo();
    logger = createMockLogger();
    enricher = new QueueItemEnricher(pullRequests, logger);
  });

  it('returns empty array unchanged', async () => {
    const result = await enricher.enrich([]);

    expect(result).toStrictEqual([]);
    expect(pullRequests.getColumnMaps).not.toHaveBeenCalled();
    expect(logger.warn).not.toHaveBeenCalled();
    expect(logger.debug).not.toHaveBeenCalled();
  });

  it('enriches items with pr_state from repository', async () => {
    const item = generateQueueItemHydrationData();
    (pullRequests.getColumnMaps as any).mockResolvedValue({
      pr_state: new Map([[item.pull_request_id, 'merged']]),
      last_coderabbit_acknowledged_at: new Map(),
    });

    const result = await enricher.enrich([item]);

    expect(result).toStrictEqual([{ ...item, pr_state: 'merged', last_coderabbit_acknowledged_at: undefined }]);
    expect(pullRequests.getColumnMaps).toHaveBeenCalledWith([item.pull_request_id], ['pr_state', 'last_coderabbit_acknowledged_at']);
    expect(logger.warn).not.toHaveBeenCalled();
    expect(logger.debug).not.toHaveBeenCalled();
  });

  it('enriches items with last_coderabbit_acknowledged_at from repository', async () => {
    const acknowledgedAt = getUniqueDate();
    const item = generateQueueItemHydrationData();
    (pullRequests.getColumnMaps as any).mockResolvedValue({
      pr_state: new Map(),
      last_coderabbit_acknowledged_at: new Map([[item.pull_request_id, acknowledgedAt]]),
    });

    const result = await enricher.enrich([item]);

    expect(result).toStrictEqual([{ ...item, last_coderabbit_acknowledged_at: acknowledgedAt }]);
    expect(logger.warn).not.toHaveBeenCalled();
    expect(logger.debug).not.toHaveBeenCalled();
  });

  it('converts null last_coderabbit_acknowledged_at to undefined', async () => {
    const item = generateQueueItemHydrationData({ last_coderabbit_acknowledged_at: undefined });
    (pullRequests.getColumnMaps as any).mockResolvedValue({
      pr_state: new Map(),
      last_coderabbit_acknowledged_at: new Map([[item.pull_request_id, null]]),
    });

    const result = await enricher.enrich([item]);

    expect(result).toStrictEqual([{ ...item, last_coderabbit_acknowledged_at: undefined }]);
    expect(logger.warn).not.toHaveBeenCalled();
    expect(logger.debug).not.toHaveBeenCalled();
  });

  it('keeps placeholder pr_state when not found in map', async () => {
    const item = generateQueueItemHydrationData({ pr_state: undefined });
    (pullRequests.getColumnMaps as any).mockResolvedValue({
      pr_state: new Map(),
      last_coderabbit_acknowledged_at: new Map(),
    });

    const result = await enricher.enrich([item]);

    expect(result).toStrictEqual([{ ...item, last_coderabbit_acknowledged_at: undefined }]);
    expect(logger.warn).not.toHaveBeenCalled();
    expect(logger.debug).not.toHaveBeenCalled();
  });

  it('deduplicates pull_request_ids across items', async () => {
    const sharedId = getUniqueInt();
    const item1 = generateQueueItemHydrationData({ pull_request_id: sharedId, pr_state: PrState.open });
    const item2 = generateQueueItemHydrationData({ pull_request_id: sharedId, pr_state: PrState.open });
    (pullRequests.getColumnMaps as any).mockResolvedValue({
      pr_state: new Map([[sharedId, 'merged']]),
      last_coderabbit_acknowledged_at: new Map(),
    });

    const result = await enricher.enrich([item1, item2]);

    expect(pullRequests.getColumnMaps).toHaveBeenCalledWith([sharedId], ['pr_state', 'last_coderabbit_acknowledged_at']);
    expect(result).toStrictEqual([
      { ...item1, pr_state: 'merged', last_coderabbit_acknowledged_at: undefined },
      { ...item2, pr_state: 'merged', last_coderabbit_acknowledged_at: undefined },
    ]);
    expect(logger.warn).not.toHaveBeenCalled();
    expect(logger.debug).not.toHaveBeenCalled();
  });

  it('calls getColumnMaps with unique ids', async () => {
    const item = generateQueueItemHydrationData();
    await enricher.enrich([item]);

    expect(pullRequests.getColumnMaps).toHaveBeenCalledWith([item.pull_request_id], ['pr_state', 'last_coderabbit_acknowledged_at']);
    expect(logger.warn).not.toHaveBeenCalled();
    expect(logger.debug).not.toHaveBeenCalled();
  });

  it('filters out null pull_request_id before calling getColumnMaps', async () => {
    const validId = getUniqueInt();
    const itemWithNull = generateQueueItemHydrationData({ pull_request_id: null as unknown as number, pr_state: undefined });
    const itemWithId = generateQueueItemHydrationData({ pull_request_id: validId });
    (pullRequests.getColumnMaps as any).mockResolvedValue({
      pr_state: new Map([[validId, 'merged']]),
      last_coderabbit_acknowledged_at: new Map(),
    });

    const result = await enricher.enrich([itemWithNull, itemWithId]);

    expect(pullRequests.getColumnMaps).toHaveBeenCalledWith([validId], ['pr_state', 'last_coderabbit_acknowledged_at']);
    expect(result[0].pr_state).toBeUndefined();
    expect(result[1].pr_state).toBe('merged');
    expect(logger.warn).toHaveBeenCalledWith(
      { fn: 'QueueItemEnricher.enrich', nullCount: 1, totalItemCount: 2 },
      'Skipping enrichment for items with null pull_request_id',
    );
  });

  it('skips enrichment entirely when all pull_request_id values are null', async () => {
    const item1 = generateQueueItemHydrationData({ pull_request_id: null as unknown as number });
    const item2 = generateQueueItemHydrationData({ pull_request_id: null as unknown as number });

    const result = await enricher.enrich([item1, item2]);

    expect(pullRequests.getColumnMaps).not.toHaveBeenCalled();
    expect(result).toStrictEqual([item1, item2]);
    expect(logger.warn).toHaveBeenCalledWith(
      { fn: 'QueueItemEnricher.enrich', nullCount: 2, totalItemCount: 2 },
      'Skipping enrichment for items with null pull_request_id',
    );
    expect(logger.debug).toHaveBeenCalledWith(
      { fn: 'QueueItemEnricher.enrich', itemCount: 2 },
      'All items have null pull_request_id; enrichment skipped entirely',
    );
  });
});
