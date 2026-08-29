import { CodeRabbitCommentType } from '../../src/domain.js';
import { isReviewVerdictState } from '../../src/utils/index.js';

import { describe, expect, it } from '@jest/globals';

describe('isReviewVerdictState', () => {
  it('returns true for review_approved', () => {
    expect(isReviewVerdictState(CodeRabbitCommentType.review_approved)).toBe(true);
  });

  it('returns true for review_changes_suggested', () => {
    expect(isReviewVerdictState(CodeRabbitCommentType.review_changes_suggested)).toBe(true);
  });

  it('returns false for review_limited', () => {
    expect(isReviewVerdictState(CodeRabbitCommentType.review_limited)).toBe(false);
  });

  it('returns false for review_skipped', () => {
    expect(isReviewVerdictState(CodeRabbitCommentType.review_skipped)).toBe(false);
  });

  it('returns false for unknown', () => {
    expect(isReviewVerdictState(CodeRabbitCommentType.unknown)).toBe(false);
  });

  it('returns false for null', () => {
    expect(isReviewVerdictState(null)).toBe(false);
  });

  it('returns false for undefined', () => {
    expect(isReviewVerdictState(undefined)).toBe(false);
  });
});
