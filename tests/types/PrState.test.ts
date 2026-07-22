import { getPrStateFromGitHubValue, PrState } from '../../src/domain.js';

import { describe, expect, it } from '@jest/globals';

describe('PrState', () => {
  it('has the expected values', () => {
    expect(PrState.open).toBe('open');
    expect(PrState.merged).toBe('merged');
    expect(PrState.closed).toBe('closed');
  });
});

describe('getPrStateFromGitHubValue', () => {
  it('returns open for "open"', () => {
    expect(getPrStateFromGitHubValue('open')).toBe('open');
  });

  it('returns merged for "merged"', () => {
    expect(getPrStateFromGitHubValue('merged')).toBe('merged');
  });

  it('returns closed for "closed"', () => {
    expect(getPrStateFromGitHubValue('closed')).toBe('closed');
  });

  it('is case-insensitive', () => {
    expect(getPrStateFromGitHubValue('OPEN')).toBe('open');
    expect(getPrStateFromGitHubValue('Merged')).toBe('merged');
    expect(getPrStateFromGitHubValue('CLOSED')).toBe('closed');
  });

  it('throws for an unexpected value', () => {
    expect(() => getPrStateFromGitHubValue('unknown')).toThrowDetailedError('UNEXPECTED_SWITCH_VALUE', {
      message: 'Unexpected GitHub PR state: "unknown"',
      functionName: 'getPrStateFromGitHubValue',
      details: { unexpectedValue: 'unknown' },
    });
  });
});
