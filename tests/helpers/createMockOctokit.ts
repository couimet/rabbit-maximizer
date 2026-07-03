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

export interface MockPullsRest {
  get: jest.Mock<any>;
}

export interface MockOctokitOptions {
  rest?: {
    search?: Partial<MockSearchRest>;
    issues?: Partial<MockIssuesRest>;
    pulls?: Partial<MockPullsRest>;
  };
}

export interface MockOctokitResult {
  octokit: Octokit;
  rest: {
    search: MockSearchRest;
    issues: MockIssuesRest;
    pulls: MockPullsRest;
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
  const pulls: MockPullsRest = {
    get: jest.fn<any>(),
    ...options?.rest?.pulls,
  };

  return {
    octokit: { rest: { search, issues, pulls } } as unknown as Octokit,
    rest: { search, issues, pulls },
  };
};
