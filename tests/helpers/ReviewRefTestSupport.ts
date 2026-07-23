import { buildCommentUrl } from '../../src/github/index.js';

import { getUniqueInt, getUniqueRepoRef, getUniqueString } from '@couimet/dynamic-testing';

export interface ReviewRefInput {
  readonly repoFullName?: string;
  readonly prNumber?: number;
  readonly commentId?: number;
  readonly prTitle?: string;
}

export interface ReviewRef {
  readonly repoFullName: string;
  readonly owner: string;
  readonly repo: string;
  readonly prNumber: number;
  readonly commentId: number;
  readonly commentUrl: string;
  readonly prTitle: string;
}

export const generateReviewRef = (overrides?: ReviewRefInput): ReviewRef => {
  const repoRef = getUniqueRepoRef();
  const repoFullName = overrides?.repoFullName ?? repoRef.fullName;
  const prNumber = overrides?.prNumber ?? getUniqueInt();
  const commentId = overrides?.commentId ?? getUniqueInt();
  const prTitle = overrides?.prTitle ?? getUniqueString({ prefix: `pr-title-${prNumber}-` });
  const commentUrl = buildCommentUrl(repoFullName, prNumber, commentId);

  return { repoFullName, owner: repoRef.owner, repo: repoRef.repo, prNumber, commentId, commentUrl, prTitle };
};
