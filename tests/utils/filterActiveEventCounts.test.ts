import { filterActiveEventCounts } from '../../src/utils/filterActiveEventCounts.js';

import { describe, expect, it } from '@jest/globals';

describe('filterActiveEventCounts', () => {
  it('removes bypassed and completed from event counts', () => {
    const counts = { detected: 8, enqueued: 7, retriggered: 3, bypassed: 2, completed: 1, failed: 1 };

    expect(filterActiveEventCounts(counts)).toStrictEqual({ detected: 8, enqueued: 7, retriggered: 3, failed: 1 });
  });

  it('returns empty object when only bypassed and completed are present', () => {
    expect(filterActiveEventCounts({ bypassed: 5, completed: 3 })).toStrictEqual({});
  });

  it('returns input unchanged when bypassed and completed are absent', () => {
    const counts = { detected: 1, enqueued: 2 };

    expect(filterActiveEventCounts(counts)).toStrictEqual({ detected: 1, enqueued: 2 });
  });
});
