import { shouldReopenStaleRetriggered } from '../../src/utils/index.js';

import { getUniqueDate, getUniqueString } from '@couimet/dynamic-testing';
import { describe, expect, it } from '@jest/globals';

const LOOKBACK_MS = 2 * 60 * 60 * 1000;

const makeItem = (retriggeredAt: Date | undefined): { readonly retriggered_at: Date | undefined } => ({ retriggered_at: retriggeredAt });

describe('shouldReopenStaleRetriggered', () => {
  it('returns false when the head SHA is missing', () => {
    const now = getUniqueDate();
    const reviewedHeadSha = getUniqueString({ prefix: 'sha-' });
    const item = makeItem(new Date(now.getTime() - LOOKBACK_MS - 1000));

    expect(shouldReopenStaleRetriggered(item, undefined, reviewedHeadSha, LOOKBACK_MS, now)).toBe(false);
  });

  it('returns false when the reviewed head SHA is missing', () => {
    const now = getUniqueDate();
    const headSha = getUniqueString({ prefix: 'sha-' });
    const item = makeItem(new Date(now.getTime() - LOOKBACK_MS - 1000));

    expect(shouldReopenStaleRetriggered(item, headSha, undefined, LOOKBACK_MS, now)).toBe(false);
  });

  it('returns false when the reviewed head equals the head', () => {
    const now = getUniqueDate();
    const headSha = getUniqueString({ prefix: 'sha-' });
    const item = makeItem(new Date(now.getTime() - LOOKBACK_MS - 1000));

    expect(shouldReopenStaleRetriggered(item, headSha, headSha, LOOKBACK_MS, now)).toBe(false);
  });

  it('returns false when the item has no retriggered_at', () => {
    const now = getUniqueDate();
    const headSha = getUniqueString({ prefix: 'sha-' });
    const reviewedHeadSha = getUniqueString({ prefix: 'sha-' });

    expect(shouldReopenStaleRetriggered(makeItem(undefined), headSha, reviewedHeadSha, LOOKBACK_MS, now)).toBe(false);
  });

  it('returns true when retriggered_at is older than the lookback', () => {
    const now = getUniqueDate();
    const headSha = getUniqueString({ prefix: 'sha-' });
    const reviewedHeadSha = getUniqueString({ prefix: 'sha-' });
    const item = makeItem(new Date(now.getTime() - LOOKBACK_MS - 1000));

    expect(shouldReopenStaleRetriggered(item, headSha, reviewedHeadSha, LOOKBACK_MS, now)).toBe(true);
  });

  it('returns false when retriggered_at is within the lookback', () => {
    const now = getUniqueDate();
    const headSha = getUniqueString({ prefix: 'sha-' });
    const reviewedHeadSha = getUniqueString({ prefix: 'sha-' });
    const item = makeItem(new Date(now.getTime() - LOOKBACK_MS + 1000));

    expect(shouldReopenStaleRetriggered(item, headSha, reviewedHeadSha, LOOKBACK_MS, now)).toBe(false);
  });

  it('returns false when retriggered_at sits exactly at the lookback boundary', () => {
    const now = getUniqueDate();
    const headSha = getUniqueString({ prefix: 'sha-' });
    const reviewedHeadSha = getUniqueString({ prefix: 'sha-' });
    const item = makeItem(new Date(now.getTime() - LOOKBACK_MS));

    expect(shouldReopenStaleRetriggered(item, headSha, reviewedHeadSha, LOOKBACK_MS, now)).toBe(false);
  });
});
