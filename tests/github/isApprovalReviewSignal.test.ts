import { isApprovalReviewSignal } from '../../src/github/index.js';

import { getRandomString, getUniqueString } from '@couimet/dynamic-testing';
import { beforeEach, describe, expect, it } from '@jest/globals';

describe('isApprovalReviewSignal', () => {
  let phrase: string;
  let phrases: readonly string[];

  beforeEach(() => {
    phrase = getUniqueString({ prefix: 'approval-' });
    phrases = [phrase];
  });

  it('returns true when the body contains a configured phrase', () => {
    expect(isApprovalReviewSignal(phrase, phrases)).toBe(true);
  });

  it('returns true when the phrase is embedded in a larger body', () => {
    expect(isApprovalReviewSignal(`## Summary\n\n${phrase}\n\nThanks!`, phrases)).toBe(true);
  });

  it('returns false when the body holds no configured phrase', () => {
    expect(isApprovalReviewSignal(getRandomString(), phrases)).toBe(false);
  });

  it('returns false when the phrase list holds nothing', () => {
    expect(isApprovalReviewSignal(phrase, [])).toBe(false);
  });

  it('returns false for an empty body', () => {
    expect(isApprovalReviewSignal('', phrases)).toBe(false);
  });
});
