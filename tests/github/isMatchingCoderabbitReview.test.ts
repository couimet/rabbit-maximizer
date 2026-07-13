import { type CoderabbitReviewCandidate, isMatchingCoderabbitReview } from '../../src/github/isMatchingCoderabbitReview.js';

import { describe, expect, it } from '@jest/globals';

const makeCandidate = (overrides: Partial<CoderabbitReviewCandidate> = {}): CoderabbitReviewCandidate => ({
  user: { login: 'coderabbitai[bot]' },
  submitted_at: new Date().toISOString(),
  state: 'APPROVED',
  ...overrides,
});

describe('isMatchingCoderabbitReview', () => {
  const since = new Date('2020-01-01');

  it('returns true for a matching CodeRabbit review', () => {
    expect(isMatchingCoderabbitReview(makeCandidate(), since)).toBe(true);
  });

  it('returns false when user login does not match CodeRabbit bot', () => {
    expect(isMatchingCoderabbitReview(makeCandidate({ user: { login: 'some-human' } }), since)).toBe(false);
  });

  it('returns false when user is null', () => {
    expect(isMatchingCoderabbitReview(makeCandidate({ user: null }), since)).toBe(false);
  });

  it('returns false when submitted_at is null', () => {
    expect(isMatchingCoderabbitReview(makeCandidate({ submitted_at: null }), since)).toBe(false);
  });

  it('returns false when submitted_at is before the since date', () => {
    expect(isMatchingCoderabbitReview(makeCandidate({ submitted_at: '2019-01-01T00:00:00Z' }), since)).toBe(false);
  });

  it('returns false when state is unknown', () => {
    expect(isMatchingCoderabbitReview(makeCandidate({ state: 'COMMENTED' }), since)).toBe(false);
  });

  it('returns false when state is undefined', () => {
    expect(isMatchingCoderabbitReview(makeCandidate({ state: undefined }), since)).toBe(false);
  });
});
