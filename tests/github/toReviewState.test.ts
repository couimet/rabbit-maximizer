import { toReviewState } from '../../src/github/index.js';

import { describe, expect, it } from '@jest/globals';

describe('toReviewState', () => {
  it('returns approved for APPROVED', () => {
    expect(toReviewState('APPROVED')).toBe('approved');
  });

  it('returns changes_requested for CHANGES_REQUESTED', () => {
    expect(toReviewState('CHANGES_REQUESTED')).toBe('changes_requested');
  });

  it('throws for unknown state via forUnexpectedSwitchDefault', () => {
    expect(() => toReviewState('COMMENTED')).toThrowDetailedError('UNEXPECTED_CODE_PATH', {
      message: 'Unexpected GitHub review state: "COMMENTED"',
      functionName: 'toReviewState',
      details: { unexpectedValue: 'COMMENTED' },
    });
  });
});
