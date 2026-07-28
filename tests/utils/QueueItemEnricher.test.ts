import { QueueItemEnricher } from '../../src/utils/QueueItemEnricher.js';
import { createMockPullRequestRepo, generateQueueItemHydrationData, generateReviewRef } from '../helpers/index.js';

import { getUniqueDate, getUniqueInt } from '@couimet/dynamic-testing';
import type { Logger } from '@couimet/logger-contract';
import { beforeEach, describe, expect, it } from '@jest/globals';

const { createMockLogger } = await import('@couimet/logger-contract-testing');

const BASE_COLUMNS = ['author_login', 'last_coderabbit_acknowledged_at', 'last_review_state', 'last_review_url', 'pr_state'];

const BASE_MAPS = {
  pr_state: new Map(),
  last_coderabbit_acknowledged_at: new Map(),
  author_login: new Map(),
  last_review_url: new Map(),
  last_review_state: new Map(),
};

const ENRICHED_DEFAULTS = { prState: undefined, lastCoderabbitAcknowledgedAt: undefined, authorLogin: '<unknown>', coderabbitReview: undefined };

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
    (pullRequests.getColumnMaps as any).mockResolvedValue({ ...BASE_MAPS, pr_state: new Map([[item.pull_request_id, 'merged']]) });

    const result = await enricher.enrich([item]);

    expect(result).toStrictEqual([{ ...item, ...ENRICHED_DEFAULTS, prState: 'merged' }]);
    expect(pullRequests.getColumnMaps).toHaveBeenCalledWith([item.pull_request_id], BASE_COLUMNS);
    expect(logger.warn).not.toHaveBeenCalled();
    expect(logger.debug).not.toHaveBeenCalled();
  });

  it('enriches items with last_coderabbit_acknowledged_at from repository', async () => {
    const acknowledgedAt = getUniqueDate();
    const item = generateQueueItemHydrationData();
    (pullRequests.getColumnMaps as any).mockResolvedValue({ ...BASE_MAPS, last_coderabbit_acknowledged_at: new Map([[item.pull_request_id, acknowledgedAt]]) });

    const result = await enricher.enrich([item]);

    expect(result).toStrictEqual([{ ...item, ...ENRICHED_DEFAULTS, lastCoderabbitAcknowledgedAt: acknowledgedAt }]);
    expect(logger.warn).not.toHaveBeenCalled();
    expect(logger.debug).not.toHaveBeenCalled();
  });

  it('converts null last_coderabbit_acknowledged_at to undefined', async () => {
    const item = generateQueueItemHydrationData();
    (pullRequests.getColumnMaps as any).mockResolvedValue({ ...BASE_MAPS, last_coderabbit_acknowledged_at: new Map([[item.pull_request_id, null]]) });

    const result = await enricher.enrich([item]);

    expect(result).toStrictEqual([{ ...item, ...ENRICHED_DEFAULTS }]);
    expect(logger.warn).not.toHaveBeenCalled();
    expect(logger.debug).not.toHaveBeenCalled();
  });

  it('keeps placeholder pr_state when not found in map', async () => {
    const item = generateQueueItemHydrationData();
    (pullRequests.getColumnMaps as any).mockResolvedValue({ ...BASE_MAPS });

    const result = await enricher.enrich([item]);

    expect(result).toStrictEqual([{ ...item, ...ENRICHED_DEFAULTS }]);
    expect(logger.warn).not.toHaveBeenCalled();
    expect(logger.debug).not.toHaveBeenCalled();
  });

  it('populates coderabbitReview when both review columns are set', async () => {
    const item = generateQueueItemHydrationData();
    const reviewUrl = generateReviewRef().commentUrl;
    (pullRequests.getColumnMaps as any).mockResolvedValue({
      ...BASE_MAPS,
      last_review_url: new Map([[item.pull_request_id, reviewUrl]]),
      last_review_state: new Map([[item.pull_request_id, 'review_approved']]),
    });

    const result = await enricher.enrich([item]);

    expect(result).toStrictEqual([{ ...item, ...ENRICHED_DEFAULTS, coderabbitReview: { htmlUrl: reviewUrl, state: 'review_approved' } }]);
    expect(logger.warn).not.toHaveBeenCalled();
    expect(logger.debug).not.toHaveBeenCalled();
  });

  it('keeps coderabbitReview undefined when only review URL is set', async () => {
    const item = generateQueueItemHydrationData();
    const reviewUrl = generateReviewRef().commentUrl;
    (pullRequests.getColumnMaps as any).mockResolvedValue({
      ...BASE_MAPS,
      last_review_url: new Map([[item.pull_request_id, reviewUrl]]),
    });

    const result = await enricher.enrich([item]);

    expect(result).toStrictEqual([{ ...item, ...ENRICHED_DEFAULTS }]);
    expect(logger.warn).not.toHaveBeenCalled();
    expect(logger.debug).not.toHaveBeenCalled();
  });

  it('deduplicates pull_request_ids across items', async () => {
    const sharedId = getUniqueInt();
    const item1 = generateQueueItemHydrationData({ pull_request_id: sharedId });
    const item2 = generateQueueItemHydrationData({ pull_request_id: sharedId });
    (pullRequests.getColumnMaps as any).mockResolvedValue({ ...BASE_MAPS, pr_state: new Map([[sharedId, 'merged']]) });

    const result = await enricher.enrich([item1, item2]);

    expect(pullRequests.getColumnMaps).toHaveBeenCalledWith([sharedId], BASE_COLUMNS);
    expect(result).toStrictEqual([
      { ...item1, ...ENRICHED_DEFAULTS, prState: 'merged' },
      { ...item2, ...ENRICHED_DEFAULTS, prState: 'merged' },
    ]);
    expect(logger.warn).not.toHaveBeenCalled();
    expect(logger.debug).not.toHaveBeenCalled();
  });

  it('calls getColumnMaps with unique ids', async () => {
    const item = generateQueueItemHydrationData();
    (pullRequests.getColumnMaps as any).mockResolvedValue({ ...BASE_MAPS });
    await enricher.enrich([item]);

    expect(pullRequests.getColumnMaps).toHaveBeenCalledWith([item.pull_request_id], BASE_COLUMNS);
    expect(logger.warn).not.toHaveBeenCalled();
    expect(logger.debug).not.toHaveBeenCalled();
  });

  it('filters out null pull_request_id before calling getColumnMaps', async () => {
    const validId = getUniqueInt();
    const itemWithNull = generateQueueItemHydrationData({ pull_request_id: null as unknown as number });
    const itemWithId = generateQueueItemHydrationData({ pull_request_id: validId });
    (pullRequests.getColumnMaps as any).mockResolvedValue({ ...BASE_MAPS, pr_state: new Map([[validId, 'merged']]) });

    const result = await enricher.enrich([itemWithNull, itemWithId]);

    expect(pullRequests.getColumnMaps).toHaveBeenCalledWith([validId], BASE_COLUMNS);
    expect(result[0].prState).toBeUndefined();
    expect(result[1].prState).toBe('merged');
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
    expect(result).toStrictEqual([
      { ...item1, ...ENRICHED_DEFAULTS },
      { ...item2, ...ENRICHED_DEFAULTS },
    ]);
    expect(logger.warn).toHaveBeenCalledWith(
      { fn: 'QueueItemEnricher.enrich', nullCount: 2, totalItemCount: 2 },
      'Skipping enrichment for items with null pull_request_id',
    );
    expect(logger.debug).toHaveBeenCalledWith(
      { fn: 'QueueItemEnricher.enrich', itemCount: 2 },
      'All items have null pull_request_id; enrichment skipped entirely',
    );
  });

  it('enriches items with author_login from the repository', async () => {
    const pullRequestId = getUniqueInt();
    const item = generateQueueItemHydrationData({ pull_request_id: pullRequestId });
    (pullRequests.getColumnMaps as any).mockResolvedValue({ ...BASE_MAPS, author_login: new Map([[pullRequestId, 'some-login']]) });

    const result = await enricher.enrich([item]);

    expect(result).toStrictEqual([{ ...item, ...ENRICHED_DEFAULTS, authorLogin: 'some-login' }]);
    expect(logger.warn).not.toHaveBeenCalled();
    expect(logger.debug).not.toHaveBeenCalled();
  });
});
