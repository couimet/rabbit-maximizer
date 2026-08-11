import { DismissalReason } from '../../src/domain.js';

import { describe, expect, it } from '@jest/globals';

describe('DismissalReason', () => {
  it('has the correct values', () => {
    expect(DismissalReason).toStrictEqual({
      other: 'other',
      prClosedWithoutMerge: 'prClosedWithoutMerge',
      prDeleted: 'prDeleted',
      prMerged: 'prMerged',
      prNotRegistered: 'prNotRegistered',
      staleComment: 'staleComment',
    });
  });
});
