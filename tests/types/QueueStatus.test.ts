import { QueueStatus } from '../../src/types/QueueStatus.js';

import { describe, expect, it } from '@jest/globals';

describe('QueueStatus', () => {
  it('has the correct values', () => {
    expect(QueueStatus).toStrictEqual({
      pending: 'pending',
      retriggered: 'retriggered',
      reviewed: 'reviewed',
      failed: 'failed',
      coderabbit_skipped: 'coderabbit_skipped',
    });
  });
});
