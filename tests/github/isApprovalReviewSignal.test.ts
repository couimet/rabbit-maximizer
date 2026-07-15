import { isApprovalReviewSignal } from '../../src/github/isApprovalReviewSignal.js';

import { describe, expect, it } from '@jest/globals';

describe('isApprovalReviewSignal', () => {
  it('returns true when body contains the no-actionable marker', () => {
    expect(isApprovalReviewSignal('No actionable comments were generated in the recent review.')).toBe(true);
  });

  it('returns true when the marker is embedded in a larger body', () => {
    expect(isApprovalReviewSignal('## Summary\n\nNo actionable comments were generated in the recent review.\n\nThanks!')).toBe(true);
  });

  it('returns false when body contains the actionable-comments marker', () => {
    expect(isApprovalReviewSignal('**Actionable comments posted: 3**')).toBe(false);
  });

  it('returns false for unrelated bodies', () => {
    expect(isApprovalReviewSignal('Looks good to me!')).toBe(false);
  });

  it('returns false for empty body', () => {
    expect(isApprovalReviewSignal('')).toBe(false);
  });
});
