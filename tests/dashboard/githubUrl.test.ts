import { prUrl, repoUrl } from '../../dashboard/src/githubUrl.js';
import { describe, expect, it } from '@jest/globals';

describe('repoUrl', () => {
  it('returns the GitHub repository URL for a full repo name', () => {
    expect(repoUrl('couimet/rabbit-maximizer')).toBe('https://github.com/couimet/rabbit-maximizer');
  });
});

describe('prUrl', () => {
  it('returns the GitHub pull request URL for a repo and PR number', () => {
    expect(prUrl('couimet/rabbit-maximizer', 42)).toBe('https://github.com/couimet/rabbit-maximizer/pull/42');
  });
});
