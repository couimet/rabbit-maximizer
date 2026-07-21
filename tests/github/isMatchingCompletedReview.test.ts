import { isMatchingCompletedReview } from '../../src/github/isMatchingCompletedReview.js';
import { generateReviewCandidateHydrationData } from '../helpers/index.js';

import { getUniqueDate } from '@couimet/dynamic-testing';
import { describe, expect, it } from '@jest/globals';

const MS_PER_HOUR = 60 * 60 * 1000;

describe('isMatchingCompletedReview', () => {
  it('returns true when review matches all criteria with the actionable marker', () => {
    const since = getUniqueDate();
    const review = generateReviewCandidateHydrationData({ submitted_at: new Date(since.getTime() + MS_PER_HOUR).toISOString() });
    expect(isMatchingCompletedReview(review, since)).toBe(true);
  });

  it('returns true when review matches all criteria with the no-actionable marker', () => {
    const since = getUniqueDate();
    const review = generateReviewCandidateHydrationData({
      body: 'No actionable comments were generated in the recent review.',
      submitted_at: new Date(since.getTime() + MS_PER_HOUR).toISOString(),
    });
    expect(isMatchingCompletedReview(review, since)).toBe(true);
  });

  it('returns false when submitted_at is before the since date', () => {
    const since = getUniqueDate();
    const review = generateReviewCandidateHydrationData({ submitted_at: new Date(since.getTime() - MS_PER_HOUR).toISOString() });
    expect(isMatchingCompletedReview(review, since)).toBe(false);
  });

  it('returns false when user login is not the CodeRabbit bot', () => {
    const since = getUniqueDate();
    const review = generateReviewCandidateHydrationData({ user: { login: 'human-user' }, submitted_at: new Date(since.getTime() + MS_PER_HOUR).toISOString() });
    expect(isMatchingCompletedReview(review, since)).toBe(false);
  });

  it('returns false when user is null', () => {
    const since = getUniqueDate();
    const review = { ...generateReviewCandidateHydrationData({ submitted_at: new Date(since.getTime() + MS_PER_HOUR).toISOString() }), user: null };
    expect(isMatchingCompletedReview(review, since)).toBe(false);
  });

  it('returns false when body does not contain a completion signal', () => {
    const since = getUniqueDate();
    const review = generateReviewCandidateHydrationData({
      body: 'Just a normal comment.',
      submitted_at: new Date(since.getTime() + MS_PER_HOUR).toISOString(),
    });
    expect(isMatchingCompletedReview(review, since)).toBe(false);
  });

  it('returns false when body is null', () => {
    const since = getUniqueDate();
    const review = { ...generateReviewCandidateHydrationData({ submitted_at: new Date(since.getTime() + MS_PER_HOUR).toISOString() }), body: null };
    expect(isMatchingCompletedReview(review, since)).toBe(false);
  });

  it('returns false when submitted_at is null', () => {
    const since = getUniqueDate();
    const review = { ...generateReviewCandidateHydrationData(), submitted_at: null };
    expect(isMatchingCompletedReview(review, since)).toBe(false);
  });
});
