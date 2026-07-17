import {
  REVIEW_BOT_RATE_LIMIT_MARKER,
  REVIEW_BOT_RETRIGGER_COMMAND,
  REVIEW_BOT_SELF_MARKER_PREFIX,
  REVIEW_BOT_SKIP_MARKER,
  REVIEW_STACK_MARKER,
} from '../../src/types/coderabbit.js';

import { describe, expect, it } from '@jest/globals';

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

  it('REVIEW_BOT_SKIP_MARKER is the known CodeRabbit skip marker', () => {
    expect(REVIEW_BOT_SKIP_MARKER).toBe('skip review by coderabbit.ai');
  });

  it('REVIEW_STACK_MARKER is the known CodeRabbit stack entry marker', () => {
    expect(REVIEW_STACK_MARKER).toBe('review_stack_entry_start');
  });
});
