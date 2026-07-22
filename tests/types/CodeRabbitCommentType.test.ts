import { CodeRabbitCommentType } from '../../src/github/index.js';

import { describe, expect, it } from '@jest/globals';

describe('CodeRabbitCommentType', () => {
  it('has the correct values', () => {
    expect(CodeRabbitCommentType).toStrictEqual({
      review_limited: 'review_limited',
      review_skipped: 'review_skipped',
      review_approved: 'review_approved',
      review_changes_suggested: 'review_changes_suggested',
      unknown: 'unknown',
    });
  });
});
