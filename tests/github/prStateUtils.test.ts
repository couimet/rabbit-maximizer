import { isPRClosedWithoutMerge, isPRMerged } from '../../src/github/index.js';

import { getUniqueDate } from '@couimet/dynamic-testing';
import { beforeEach, describe, expect, it } from '@jest/globals';

describe('isPRMerged', () => {
  let closedAt: string;
  let mergedAt: string;

  beforeEach(() => {
    closedAt = getUniqueDate().toISOString();
    mergedAt = getUniqueDate().toISOString();
  });

  it('returns true for a closed PR with a merge date', () => {
    expect(isPRMerged({ state: 'closed', merged_at: mergedAt, closed_at: mergedAt })).toBe(true);
  });

  it('returns false for an open PR', () => {
    expect(isPRMerged({ state: 'open', merged_at: null, closed_at: null })).toBe(false);
  });

  it('returns false for a closed PR without a merge date', () => {
    expect(isPRMerged({ state: 'closed', merged_at: null, closed_at: closedAt })).toBe(false);
  });

  it('returns false when merged_at is a falsy empty string', () => {
    expect(isPRMerged({ state: 'closed', merged_at: '', closed_at: closedAt })).toBe(false);
  });
});

describe('isPRClosedWithoutMerge', () => {
  let closedAt: string;
  let mergedAt: string;

  beforeEach(() => {
    closedAt = getUniqueDate().toISOString();
    mergedAt = getUniqueDate().toISOString();
  });

  it('returns true for a closed PR without a merge date', () => {
    expect(isPRClosedWithoutMerge({ state: 'closed', merged_at: null, closed_at: closedAt })).toBe(true);
  });

  it('returns false for an open PR', () => {
    expect(isPRClosedWithoutMerge({ state: 'open', merged_at: null, closed_at: null })).toBe(false);
  });

  it('returns false for a closed PR with a merge date', () => {
    expect(isPRClosedWithoutMerge({ state: 'closed', merged_at: mergedAt, closed_at: mergedAt })).toBe(false);
  });

  it('returns true when merged_at is a falsy empty string', () => {
    expect(isPRClosedWithoutMerge({ state: 'closed', merged_at: '', closed_at: closedAt })).toBe(true);
  });
});
