import { isMatchingCompletedReview } from '../../src/github/isMatchingCompletedReview.js';

import { getUniqueDate, getUniqueInt } from '@couimet/dynamic-testing';
import { describe, expect, it } from '@jest/globals';

const MS_PER_HOUR = 60 * 60 * 1000;

const makeReview = (overrides: { login?: string; body?: string; submittedAt?: Date }) => ({
  user: { login: overrides.login ?? 'coderabbitai[bot]' },
  body: overrides.body ?? `**Actionable comments posted: ${getUniqueInt()}`,
  submitted_at: (overrides.submittedAt ?? getUniqueDate()).toISOString(),
});

describe('isMatchingCompletedReview', () => {
  it('returns true when review matches all criteria with the actionable marker', () => {
    const since = getUniqueDate();
    const review = makeReview({ submittedAt: new Date(since.getTime() + MS_PER_HOUR) });
    expect(isMatchingCompletedReview(review, since)).toBe(true);
  });

  it('returns true when review matches all criteria with the no-actionable marker', () => {
    const since = getUniqueDate();
    const review = makeReview({
      body: 'No actionable comments were generated in the recent review.',
      submittedAt: new Date(since.getTime() + MS_PER_HOUR),
    });
    expect(isMatchingCompletedReview(review, since)).toBe(true);
  });

  it('returns false when submitted_at is before the since date', () => {
    const since = getUniqueDate();
    const review = makeReview({ submittedAt: new Date(since.getTime() - MS_PER_HOUR) });
    expect(isMatchingCompletedReview(review, since)).toBe(false);
  });

  it('returns false when user login is not the CodeRabbit bot', () => {
    const since = getUniqueDate();
    const review = makeReview({ login: 'human-user', submittedAt: new Date(since.getTime() + MS_PER_HOUR) });
    expect(isMatchingCompletedReview(review, since)).toBe(false);
  });

  it('returns false when user is null', () => {
    const since = getUniqueDate();
    const review = { ...makeReview({ submittedAt: new Date(since.getTime() + MS_PER_HOUR) }), user: null };
    expect(isMatchingCompletedReview(review, since)).toBe(false);
  });

  it('returns false when body does not contain a completion signal', () => {
    const since = getUniqueDate();
    const review = makeReview({ body: 'Just a normal comment.', submittedAt: new Date(since.getTime() + MS_PER_HOUR) });
    expect(isMatchingCompletedReview(review, since)).toBe(false);
  });

  it('returns false when body is null', () => {
    const since = getUniqueDate();
    const review = { ...makeReview({ submittedAt: new Date(since.getTime() + MS_PER_HOUR) }), body: null };
    expect(isMatchingCompletedReview(review, since)).toBe(false);
  });

  it('returns false when submitted_at is null', () => {
    const since = getUniqueDate();
    const review = { ...makeReview({ submittedAt: getUniqueDate() }), submitted_at: null };
    expect(isMatchingCompletedReview(review, since)).toBe(false);
  });
});
