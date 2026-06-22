import { jest } from '@jest/globals';
import type { Octokit } from '@octokit/rest';

export interface MockSearchRest {
  issuesAndPullRequests: jest.Mock<any>;
}

export interface MockIssuesRest {
  createComment: jest.Mock<any>;
  getComment: jest.Mock<any>;
  listComments: jest.Mock<any>;
}

export interface MockOctokitOptions {
  rest?: {
    search?: Partial<MockSearchRest>;
    issues?: Partial<MockIssuesRest>;
  };
}

export interface MockOctokitResult {
  octokit: Octokit;
  rest: {
    search: MockSearchRest;
    issues: MockIssuesRest;
  };
}

export const createMockOctokit = (options?: MockOctokitOptions): MockOctokitResult => {
  const search: MockSearchRest = {
    issuesAndPullRequests: jest.fn<any>(),
    ...options?.rest?.search,
  };
  const issues: MockIssuesRest = {
    createComment: jest.fn<any>(),
    getComment: jest.fn<any>(),
    listComments: jest.fn<any>(),
    ...options?.rest?.issues,
  };

  return {
    octokit: { rest: { search, issues } } as unknown as Octokit,
    rest: { search, issues },
  };
};
