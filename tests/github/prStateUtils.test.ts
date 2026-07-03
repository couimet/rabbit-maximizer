import { isPRClosedWithoutMerge, isPRMerged } from '../../src/github/prStateUtils.js';
import type { PRState } from '../../src/types/PRState.js';

import { describe, expect, it } from '@jest/globals';

describe('isPRMerged', () => {
  it('returns true for a closed PR with a merge date', () => {
    const prState: PRState = { state: 'closed', merged_at: '2026-01-01T00:00:00Z' };
    expect(isPRMerged(prState)).toBe(true);
  });

  it('returns false for an open PR', () => {
    const prState: PRState = { state: 'open', merged_at: null };
    expect(isPRMerged(prState)).toBe(false);
  });

  it('returns false for a closed PR without a merge date', () => {
    const prState: PRState = { state: 'closed', merged_at: null };
    expect(isPRMerged(prState)).toBe(false);
  });

  it('returns false when merged_at is a falsy empty string', () => {
    const prState: PRState = { state: 'closed', merged_at: '' };
    expect(isPRMerged(prState)).toBe(false);
  });
});

describe('isPRClosedWithoutMerge', () => {
  it('returns true for a closed PR without a merge date', () => {
    const prState: PRState = { state: 'closed', merged_at: null };
    expect(isPRClosedWithoutMerge(prState)).toBe(true);
  });

  it('returns false for an open PR', () => {
    const prState: PRState = { state: 'open', merged_at: null };
    expect(isPRClosedWithoutMerge(prState)).toBe(false);
  });

  it('returns false for a closed PR with a merge date', () => {
    const prState: PRState = { state: 'closed', merged_at: '2026-01-01T00:00:00Z' };
    expect(isPRClosedWithoutMerge(prState)).toBe(false);
  });

  it('returns true when merged_at is a falsy empty string', () => {
    const prState: PRState = { state: 'closed', merged_at: '' };
    expect(isPRClosedWithoutMerge(prState)).toBe(true);
  });
});
