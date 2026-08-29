import { splitRepo } from '../../src/github/index.js';

import { getUniqueGitHubRepoRef } from '@couimet/dynamic-testing';
import { describe, expect, it } from '@jest/globals';

describe('splitRepo', () => {
  it('splits an owner/repo string into its two parts', () => {
    const { owner, repo, fullName } = getUniqueGitHubRepoRef();
    expect(splitRepo(fullName)).toStrictEqual({ owner, repo });
  });

  it('throws a RabbitMaximizerError when the input lacks a slash', () => {
    const { owner } = getUniqueGitHubRepoRef();
    expect(() => splitRepo(owner)).toThrowDetailedError('GITHUB_API_ERROR', {
      message: 'Invalid repo fullName format',
      functionName: 'splitRepo',
      details: { fullName: owner },
    });
  });

  it('throws a RabbitMaximizerError when the input is empty', () => {
    expect(() => splitRepo('')).toThrowDetailedError('GITHUB_API_ERROR', {
      message: 'Invalid repo fullName format',
      functionName: 'splitRepo',
      details: { fullName: '' },
    });
  });

  it('throws a RabbitMaximizerError when the repo part is missing', () => {
    const { owner } = getUniqueGitHubRepoRef();
    expect(() => splitRepo(`${owner}/`)).toThrowDetailedError('GITHUB_API_ERROR', {
      message: 'Invalid repo fullName format',
      functionName: 'splitRepo',
      details: { fullName: `${owner}/` },
    });
  });
});
