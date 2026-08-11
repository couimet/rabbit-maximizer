import { EventType } from '../../src/domain.js';

import { describe, expect, it } from '@jest/globals';

describe('EventType', () => {
  it('has the correct values', () => {
    expect(EventType).toStrictEqual({
      coderabbit_review_approved: 'coderabbit_review_approved',
      coderabbit_review_changes_suggested: 'coderabbit_review_changes_suggested',
      coderabbit_review_skipped: 'coderabbit_review_skipped',
      detected: 'detected',
      dismissed: 'dismissed',
      enqueued: 'enqueued',
      failed: 'failed',
      retriggered: 'retriggered',
    });
  });
});
