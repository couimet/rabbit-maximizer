import { EventType, QueueStatus, REVIEW_BOT_RATE_LIMIT_MARKER, REVIEW_BOT_RETRIGGER_COMMAND, REVIEW_BOT_SELF_MARKER_PREFIX } from '../src/types/index.js';

import { describe, expect, it } from '@jest/globals';

describe('QueueStatus', () => {
  it('has the correct values', () => {
    expect(QueueStatus).toStrictEqual({
      pending: 'pending',
      completed: 'completed',
      failed: 'failed',
    });
  });
});

describe('EventType', () => {
  it('has the correct values', () => {
    expect(EventType).toStrictEqual({
      detected: 'detected',
      enqueued: 'enqueued',
      posted: 'posted',
      rejected: 'rejected',
      completed: 'completed',
      failed: 'failed',
    });
  });
});

describe('coderabbit constants', () => {
  it('REVIEW_BOT_SELF_MARKER_PREFIX matches our tool marker', () => {
    expect(REVIEW_BOT_SELF_MARKER_PREFIX).toBe('<!-- rabbit-optimizer');
  });

  it('REVIEW_BOT_RATE_LIMIT_MARKER is the known CodeRabbit hidden marker', () => {
    expect(REVIEW_BOT_RATE_LIMIT_MARKER).toBe('rate limited by coderabbit.ai');
  });

  it('REVIEW_BOT_RETRIGGER_COMMAND is the full review command', () => {
    expect(REVIEW_BOT_RETRIGGER_COMMAND).toBe('@coderabbitai full review');
  });
});
