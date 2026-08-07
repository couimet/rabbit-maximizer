import { PrState } from '../../src/domain.js';
import { dismissalReasonFromPrState } from '../../src/utils/index.js';

import { describe, expect, it } from '@jest/globals';

describe('dismissalReasonFromPrState', () => {
  it('returns prMerged for PrState.merged', () => {
    expect(dismissalReasonFromPrState(PrState.merged)).toBe('prMerged');
  });

  it('returns prClosedWithoutMerge for PrState.closed', () => {
    expect(dismissalReasonFromPrState(PrState.closed)).toBe('prClosedWithoutMerge');
  });

  it('throws for an unexpected PrState value', () => {
    expect(() => dismissalReasonFromPrState('bogus' as PrState)).toThrowDetailedError('UNEXPECTED_SWITCH_VALUE', {
      message: 'Unexpected prState: "bogus"',
      functionName: 'dismissalReasonFromPrState',
      details: { unexpectedValue: 'bogus' },
    });
  });
});
