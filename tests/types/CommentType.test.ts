import { CommentType } from '../../src/types/CommentType.js';

import { describe, expect, it } from '@jest/globals';

describe('CommentType', () => {
  it('has the correct values', () => {
    expect(CommentType).toStrictEqual({
      review_limited: 'review_limited',
      review_skipped: 'review_skipped',
      review_approved: 'review_approved',
      review_changes_suggested: 'review_changes_suggested',
    });
  });
});
