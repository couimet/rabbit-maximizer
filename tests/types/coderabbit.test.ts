import { REVIEW_BOT_RETRIGGER_COMMAND, REVIEW_BOT_SELF_MARKER_PREFIX } from '../../src/github/index.js';

import { describe, expect, it } from '@jest/globals';

describe('coderabbit constants', () => {
  it('REVIEW_BOT_SELF_MARKER_PREFIX matches our tool marker', () => {
    expect(REVIEW_BOT_SELF_MARKER_PREFIX).toBe('<!-- rabbit-maximizer');
  });

  it('REVIEW_BOT_RETRIGGER_COMMAND is the full review command', () => {
    expect(REVIEW_BOT_RETRIGGER_COMMAND).toBe('@coderabbitai full review');
  });
});
