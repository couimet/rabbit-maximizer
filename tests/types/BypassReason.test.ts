import { BypassReason } from '../../src/types/EventPayloads.js';

import { describe, expect, it } from '@jest/globals';

describe('BypassReason', () => {
  it('has the correct values', () => {
    expect(BypassReason).toStrictEqual({
      prMerged: 'prMerged',
      prClosedWithoutMerge: 'prClosedWithoutMerge',
      other: 'other',
    });
  });
});
