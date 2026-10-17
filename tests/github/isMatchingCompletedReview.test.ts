import { isMatchingCompletedReview, SubmittedReview } from '../../src/github/index.js';

import { getRandomString, getUniqueDate, getUniqueString } from '@couimet/dynamic-testing';
import { beforeEach, describe, expect, it } from '@jest/globals';

const MS_PER_HOUR = 60 * 60 * 1000;

describe('isMatchingCompletedReview', () => {
  let phrase: string;
  let phrases: readonly string[];
  let since: Date;

  beforeEach(() => {
    phrase = getUniqueString({ prefix: 'verdict-' });
    phrases = [phrase];
    since = getUniqueDate();
  });

  it('returns true when the review matches every criterion', () => {
    const review = SubmittedReview.create({
      commitId: getUniqueString(),
      userLogin: 'coderabbitai[bot]',
      body: phrase,
      submittedAt: new Date(since.getTime() + MS_PER_HOUR).toISOString(),
    });

    expect(isMatchingCompletedReview(review, since, phrases)).toBe(true);
  });

  it('returns false when submitted_at is before the since date', () => {
    const review = SubmittedReview.create({
      commitId: getUniqueString(),
      userLogin: 'coderabbitai[bot]',
      body: phrase,
      submittedAt: new Date(since.getTime() - MS_PER_HOUR).toISOString(),
    });

    expect(isMatchingCompletedReview(review, since, phrases)).toBe(false);
  });

  it('returns false when user login is not the CodeRabbit bot', () => {
    const review = SubmittedReview.create({
      commitId: getUniqueString(),
      userLogin: 'human-user',
      body: phrase,
      submittedAt: new Date(since.getTime() + MS_PER_HOUR).toISOString(),
    });

    expect(isMatchingCompletedReview(review, since, phrases)).toBe(false);
  });

  it('returns false when user is null', () => {
    const review = SubmittedReview.create({
      commitId: getUniqueString(),
      userLogin: undefined,
      body: phrase,
      submittedAt: new Date(since.getTime() + MS_PER_HOUR).toISOString(),
    });

    expect(isMatchingCompletedReview(review, since, phrases)).toBe(false);
  });

  it('returns false when body holds no configured phrase', () => {
    const review = SubmittedReview.create({
      commitId: getUniqueString(),
      userLogin: 'coderabbitai[bot]',
      body: getRandomString(),
      submittedAt: new Date(since.getTime() + MS_PER_HOUR).toISOString(),
    });

    expect(isMatchingCompletedReview(review, since, phrases)).toBe(false);
  });

  it('returns false when the phrase list holds nothing', () => {
    const review = SubmittedReview.create({
      commitId: getUniqueString(),
      userLogin: 'coderabbitai[bot]',
      body: phrase,
      submittedAt: new Date(since.getTime() + MS_PER_HOUR).toISOString(),
    });

    expect(isMatchingCompletedReview(review, since, [])).toBe(false);
  });

  it('returns false when body is null', () => {
    const review = SubmittedReview.create({
      commitId: getUniqueString(),
      userLogin: 'coderabbitai[bot]',
      body: undefined,
      submittedAt: new Date(since.getTime() + MS_PER_HOUR).toISOString(),
    });

    expect(isMatchingCompletedReview(review, since, phrases)).toBe(false);
  });

  it('returns false when submitted_at is null', () => {
    const review = SubmittedReview.create({
      commitId: getUniqueString(),
      userLogin: 'coderabbitai[bot]',
      body: phrase,
      submittedAt: undefined,
    });

    expect(isMatchingCompletedReview(review, since, phrases)).toBe(false);
  });
});
