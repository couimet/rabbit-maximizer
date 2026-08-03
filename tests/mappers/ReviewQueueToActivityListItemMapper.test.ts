import { PrState, QueueStatus } from '../../src/domain.js';
import { ReviewQueueToActivityListItemMapper } from '../../src/mappers/index.js';
import { generateQueueItemHydrationData } from '../helpers/index.js';

import { getUniqueDate } from '@couimet/dynamic-testing';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const ONE_DAY_MS = 86_400_000;
const REVIEW_URL = 'https://gh/r/1';
const REVIEW_STATE = 'review_approved';

describe('ReviewQueueToActivityListItemMapper', () => {
  let enricher: { enrich: jest.Mock<any> };
  let mapper: ReviewQueueToActivityListItemMapper;

  beforeEach(() => {
    enricher = {
      enrich: jest.fn<any>().mockImplementation((items: any[]) =>
        Promise.resolve(
          items.map((item: any) => ({
            ...item,
            prState: PrState.open,
            lastCoderabbitAcknowledgedAt: undefined,
            authorLogin: 'test-author',
            coderabbitReview: undefined,
            reviewCount: 0,
            retriggerCount: 0,
          })),
        ),
      ),
    };
    mapper = new ReviewQueueToActivityListItemMapper(enricher as any);
  });

  it('maps enriched items to ActivityListItemResponse', async () => {
    const created = getUniqueDate();
    const createdIso = created.toISOString();
    const item = generateQueueItemHydrationData({
      created_at: created,
      pr_title: 'Test PR',
      source_comment_url: 'https://gh/c/1',
      status: QueueStatus.pending,
      resolution: undefined,
      retrigger_comment_url: undefined,
      retriggered_at: undefined,
      resolved_at: undefined,
      failed_at: undefined,
    });

    const [result] = await mapper.mapToList([item]);

    expect(result).toStrictEqual({
      uuid: item.uuid,
      repo_full_name: item.repo_full_name,
      pr_number: item.pr_number,
      pr_title: 'Test PR',
      author_login: 'test-author',
      status: 'pending',
      resolution: null,
      retriggered_at: null,
      resolved_at: null,
      failed_at: null,
      created_at: createdIso,
      retrigger_comment_url: null,
      source_comment_url: 'https://gh/c/1',
      last_review_url: null,
      last_review_state: null,
      review_count: 0,
      retrigger_count: 0,
      last_coderabbit_acknowledged_at: null,
      pr_state: 'open',
      last_activity_at: createdIso,
    });
  });

  it('computes last_activity_at from the most recent timestamp', async () => {
    const older = getUniqueDate();
    const newer = new Date(older.getTime() + ONE_DAY_MS);
    const newerIso = newer.toISOString();
    const item = generateQueueItemHydrationData({ created_at: older, resolved_at: newer });

    const [result] = await mapper.mapToList([item]);

    expect(result.last_activity_at).toBe(newerIso);
  });

  it('picks failed_at when it is the most recent', async () => {
    const older = getUniqueDate();
    const newer = new Date(older.getTime() + ONE_DAY_MS);
    const newerIso = newer.toISOString();
    const item = generateQueueItemHydrationData({ created_at: older, failed_at: newer, resolved_at: undefined, retriggered_at: undefined });

    const [result] = await mapper.mapToList([item]);

    expect(result.last_activity_at).toBe(newerIso);
  });

  it('picks retriggered_at when it is the most recent', async () => {
    const older = getUniqueDate();
    const newer = new Date(older.getTime() + ONE_DAY_MS);
    const newerIso = newer.toISOString();
    const item = generateQueueItemHydrationData({ created_at: older, retriggered_at: newer, resolved_at: undefined, failed_at: undefined });

    const [result] = await mapper.mapToList([item]);

    expect(result.last_activity_at).toBe(newerIso);
  });

  it('finds the newest date even when it appears after an older date in the list', async () => {
    const oldest = getUniqueDate();
    const middle = new Date(oldest.getTime() + ONE_DAY_MS);
    const newest = new Date(middle.getTime() + ONE_DAY_MS);
    const newestIso = newest.toISOString();
    const item = generateQueueItemHydrationData({ created_at: oldest, resolved_at: middle, retriggered_at: newest, failed_at: undefined });

    const [result] = await mapper.mapToList([item]);

    expect(result.last_activity_at).toBe(newestIso);
  });

  it('passes coderabbitReview fields through', async () => {
    const item = generateQueueItemHydrationData();
    enricher.enrich.mockResolvedValue([
      {
        ...item,
        prState: PrState.merged,
        lastCoderabbitAcknowledgedAt: undefined,
        authorLogin: 'author',
        coderabbitReview: { htmlUrl: REVIEW_URL, state: REVIEW_STATE },
        reviewCount: 1,
        retriggerCount: 2,
      },
    ]);

    const [result] = await mapper.mapToList([item]);

    expect(result.last_review_url).toBe(REVIEW_URL);
    expect(result.last_review_state).toBe(REVIEW_STATE);
    expect(result.review_count).toBe(1);
    expect(result.retrigger_count).toBe(2);
  });

  it('returns empty array for no items', async () => {
    expect(await mapper.mapToList([])).toStrictEqual([]);
  });
});
