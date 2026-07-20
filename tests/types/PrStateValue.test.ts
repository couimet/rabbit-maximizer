import { PR_STATE } from '../../src/types/PrStateValue.js';

import { describe, expect, it } from '@jest/globals';

describe('PR_STATE', () => {
  it('has the expected values', () => {
    expect(PR_STATE.OPEN).toBe('open');
    expect(PR_STATE.MERGED).toBe('merged');
    expect(PR_STATE.CLOSED).toBe('closed');
  });
});
