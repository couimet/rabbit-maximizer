import { isMatchingCoderabbitReview } from '../../src/github/isMatchingCoderabbitReview.js';
import { SubmittedReview } from '../../src/github/types/index.js';

import { describe, expect, it } from '@jest/globals';

const makeCandidate = (overrides?: Partial<SubmittedReview>): SubmittedReview => {
  const BASE: SubmittedReview = {
    userLogin: 'coderabbitai[bot]',
    body: undefined,
    submittedAt: new Date().toISOString(),
    state: 'APPROVED',
  };
  return SubmittedReview.create({ ...BASE, ...overrides });
};

describe('isMatchingCoderabbitReview', () => {
  const since = new Date('2020-01-01');

  it('returns true for a matching CodeRabbit review', () => {
    expect(isMatchingCoderabbitReview(makeCandidate({}), since)).toBe(true);
  });

  it('returns false when user login does not match CodeRabbit bot', () => {
    expect(isMatchingCoderabbitReview(makeCandidate({ userLogin: 'some-human' }), since)).toBe(false);
  });

  it('returns false when user login is undefined', () => {
    expect(isMatchingCoderabbitReview(makeCandidate({ userLogin: undefined }), since)).toBe(false);
  });

  it('returns false when submittedAt is undefined', () => {
    expect(isMatchingCoderabbitReview(makeCandidate({ submittedAt: undefined }), since)).toBe(false);
  });

  it('returns false when submittedAt is before the since date', () => {
    expect(isMatchingCoderabbitReview(makeCandidate({ submittedAt: '2019-01-01T00:00:00Z' }), since)).toBe(false);
  });

  it('returns false when state is unknown', () => {
    expect(isMatchingCoderabbitReview(makeCandidate({ state: 'COMMENTED' }), since)).toBe(false);
  });

  it('returns false when state is undefined', () => {
    expect(isMatchingCoderabbitReview(makeCandidate({ state: undefined }), since)).toBe(false);
  });
});
