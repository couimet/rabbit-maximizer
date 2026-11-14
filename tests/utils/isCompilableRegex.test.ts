import { isCompilableRegex } from '../../src/utils/isCompilableRegex.js';

import { describe, expect, it } from '@jest/globals';

describe('isCompilableRegex', () => {
  it('returns true for a plain literal', () => {
    expect(isCompilableRegex('dependabot')).toBe(true);
  });

  it('returns true for a pattern with groups and quantifiers', () => {
    expect(isCompilableRegex('^(deps|chore)(\\(.+\\))?!?:')).toBe(true);
  });

  it('returns false for an unclosed group', () => {
    expect(isCompilableRegex('(unclosed')).toBe(false);
  });

  it('returns false for an unterminated character class', () => {
    expect(isCompilableRegex('[unterminated')).toBe(false);
  });

  it('returns false for a trailing backslash', () => {
    expect(isCompilableRegex('trailing\\')).toBe(false);
  });
});
