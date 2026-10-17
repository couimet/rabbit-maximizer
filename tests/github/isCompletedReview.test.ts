import { isCompletedReview } from '../../src/github/index.js';

import { getRandomString, getUniqueString } from '@couimet/dynamic-testing';
import { beforeEach, describe, expect, it } from '@jest/globals';

describe('isCompletedReview', () => {
  let phrase: string;
  let phrases: readonly string[];

  beforeEach(() => {
    phrase = getUniqueString({ prefix: 'verdict-' });
    phrases = [phrase];
  });

  it('returns true when the body contains a configured phrase', () => {
    expect(isCompletedReview(`## Summary by CodeRabbit\n\n${phrase}\n\nHere are the findings.`, phrases)).toBe(true);
  });

  it('matches a phrase anywhere in the body (substring check)', () => {
    expect(isCompletedReview(`${getRandomString()}\n${phrase}\n${getRandomString()}`, phrases)).toBe(true);
  });

  it('returns false when the body holds no configured phrase', () => {
    expect(isCompletedReview('Looks good to me!', phrases)).toBe(false);
  });

  it('returns false when the phrase list holds nothing', () => {
    expect(isCompletedReview(phrase, [])).toBe(false);
  });

  it('returns false for an empty body', () => {
    expect(isCompletedReview('', phrases)).toBe(false);
  });
});
