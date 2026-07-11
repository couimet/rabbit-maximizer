import { extractRepoFullName } from '../../src/github/extractRepoFullName.js';

import { getUniqueGitHubRepoRef } from '@couimet/dynamic-testing';
import { describe, expect, it } from '@jest/globals';

describe('extractRepoFullName', () => {
  it('strips the GitHub API repository prefix', () => {
    const { fullName } = getUniqueGitHubRepoRef();
    expect(extractRepoFullName(`https://api.github.com/repos/${fullName}`)).toBe(fullName);
  });

  it('throws a RabbitMaximizerError when the URL lacks the expected prefix', () => {
    const { fullName } = getUniqueGitHubRepoRef();
    const badUrl = `https://example.com/repos/${fullName}`;
    expect(() => extractRepoFullName(badUrl)).toThrowDetailedError('GITHUB_API_ERROR', {
      message: 'Invalid repository URL format',
      functionName: 'extractRepoFullName',
      details: { repositoryUrl: badUrl },
    });
  });
});
