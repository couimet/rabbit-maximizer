import { CodeRabbitCommentType } from '../../src/domain.js';
import { toReviewEventType } from '../../src/utils/index.js';

import { describe, expect, it } from '@jest/globals';

describe('toReviewEventType', () => {
  it('maps review_changes_suggested to coderabbit_review_changes_suggested', () => {
    expect(toReviewEventType(CodeRabbitCommentType.review_changes_suggested)).toBe('coderabbit_review_changes_suggested');
  });

  it('maps review_approved to coderabbit_review_approved', () => {
    expect(toReviewEventType(CodeRabbitCommentType.review_approved)).toBe('coderabbit_review_approved');
  });
});
