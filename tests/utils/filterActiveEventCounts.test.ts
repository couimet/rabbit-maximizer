import { filterActiveEventCounts } from '../../src/utils/filterActiveEventCounts.js';

import { describe, expect, it } from '@jest/globals';

describe('filterActiveEventCounts', () => {
  it('removes bypassed, coderabbit_review_approved, and coderabbit_review_changes_requested from event counts', () => {
    const counts = { detected: 8, enqueued: 7, retriggered: 3, bypassed: 2, coderabbit_review_approved: 1, coderabbit_review_changes_requested: 1, failed: 1 };

    expect(filterActiveEventCounts(counts)).toStrictEqual({ detected: 8, enqueued: 7, retriggered: 3, failed: 1 });
  });

  it('returns empty object when only excluded types are present', () => {
    expect(filterActiveEventCounts({ bypassed: 5, coderabbit_review_approved: 2, coderabbit_review_changes_requested: 1 })).toStrictEqual({});
  });

  it('returns input unchanged when excluded types are absent', () => {
    const counts = { detected: 1, enqueued: 2 };

    expect(filterActiveEventCounts(counts)).toStrictEqual({ detected: 1, enqueued: 2 });
  });
});
