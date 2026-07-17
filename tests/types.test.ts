import { EventType, QueueStatus, REVIEW_BOT_RATE_LIMIT_MARKER, REVIEW_BOT_RETRIGGER_COMMAND, REVIEW_BOT_SELF_MARKER_PREFIX } from '../src/types/index.js';

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

describe('EventType', () => {
  it('has the correct values', () => {
    expect(EventType).toStrictEqual({
      bypassed: 'bypassed',
      detected: 'detected',
      enqueued: 'enqueued',
      failed: 'failed',
      retriggered: 'retriggered',
      coderabbit_review_approved: 'coderabbit_review_approved',
      coderabbit_review_changes_requested: 'coderabbit_review_changes_requested',
      coderabbit_review_skipped: 'coderabbit_review_skipped',
    });
  });
});

describe('coderabbit constants', () => {
  it('REVIEW_BOT_SELF_MARKER_PREFIX matches our tool marker', () => {
    expect(REVIEW_BOT_SELF_MARKER_PREFIX).toBe('<!-- rabbit-maximizer');
  });

  it('REVIEW_BOT_RATE_LIMIT_MARKER is the known CodeRabbit hidden marker', () => {
    expect(REVIEW_BOT_RATE_LIMIT_MARKER).toBe('rate limited by coderabbit.ai');
  });

  it('REVIEW_BOT_RETRIGGER_COMMAND is the full review command', () => {
    expect(REVIEW_BOT_RETRIGGER_COMMAND).toBe('@coderabbitai full review');
  });
});
