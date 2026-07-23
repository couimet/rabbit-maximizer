import { buildPrUrl } from '../../src/github/index.js';

import { describe, expect, it } from '@jest/globals';

describe('buildPrUrl', () => {
  it('builds a GitHub pull request URL from a full repo name and PR number', () => {
    expect(buildPrUrl('owner/repo', 42)).toBe('https://github.com/owner/repo/pull/42');
  });

  it('handles org repos', () => {
    expect(buildPrUrl('organization-name/repo-name', 100)).toBe('https://github.com/organization-name/repo-name/pull/100');
  });
});
