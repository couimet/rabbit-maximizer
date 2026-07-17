import { EventType } from '../../src/types/EventType.js';

import { describe, expect, it } from '@jest/globals';

describe('EventType', () => {
  it('has the correct values', () => {
    expect(EventType).toStrictEqual({
      detected: 'detected',
      enqueued: 'enqueued',
      retriggered: 'retriggered',
      bypassed: 'bypassed',
      failed: 'failed',
      coderabbit_review_approved: 'coderabbit_review_approved',
      coderabbit_review_changes_requested: 'coderabbit_review_changes_requested',
      coderabbit_review_skipped: 'coderabbit_review_skipped',
    });
  });
});
