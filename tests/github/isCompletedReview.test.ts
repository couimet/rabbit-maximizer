import { isCompletedReview } from '../../src/github/isCompletedReview.js';

import { getRandomString } from '@couimet/dynamic-testing';
import { describe, expect, it } from '@jest/globals';

describe('isCompletedReview', () => {
  it('returns true when the body contains the actionable-comments marker', () => {
    const body = `## Summary by CodeRabbit\n\n**Actionable comments posted: 3**\n\nHere are the findings.`;
    expect(isCompletedReview(body)).toBe(true);
  });

  it('returns true when the body contains the no-actionable marker', () => {
    const body = '<!-- This is an auto-generated comment: summarize by coderabbit.ai -->\nNo actionable comments were generated in the recent review.';
    expect(isCompletedReview(body)).toBe(true);
  });

  it('matches markers anywhere in the body (substring check)', () => {
    const body = `${getRandomString()}\n**Actionable comments posted: 1**\n${getRandomString()}`;
    expect(isCompletedReview(body)).toBe(true);
  });

  it('returns false for unrelated bodies', () => {
    expect(isCompletedReview('Looks good to me!')).toBe(false);
  });

  it('returns false for empty body', () => {
    expect(isCompletedReview('')).toBe(false);
  });

  it('returns false for rate-limit comments', () => {
    expect(isCompletedReview('You have reached your PR review rate limit. Please wait.')).toBe(false);
  });
});
