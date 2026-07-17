import { reviewStateToEventType } from '../../src/utils/reviewStateToEventType.js';

import { describe, expect, it } from '@jest/globals';

describe('reviewStateToEventType', () => {
  it('returns coderabbit_review_approved when state is approved', () => {
    expect(reviewStateToEventType('approved')).toBe('coderabbit_review_approved');
  });

  it('returns coderabbit_review_changes_suggested when state is changes_requested', () => {
    expect(reviewStateToEventType('changes_requested')).toBe('coderabbit_review_changes_suggested');
  });

  it('returns coderabbit_review_changes_suggested for any unrecognized state (pessimistic default)', () => {
    expect(reviewStateToEventType('dismissed' as any)).toBe('coderabbit_review_changes_suggested');
  });
});
