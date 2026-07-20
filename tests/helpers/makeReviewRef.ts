import { getUniqueInt, getUniqueRepoRef } from '@couimet/dynamic-testing';

export interface ReviewRefInput {
  readonly repoFullName?: string;
  readonly prNumber?: number;
  readonly commentId?: number;
}

export interface ReviewRef {
  readonly repoFullName: string;
  readonly owner: string;
  readonly repo: string;
  readonly prNumber: number;
  readonly commentId: number;
  readonly commentUrl: string;
}

export const makeReviewRef = (overrides?: ReviewRefInput): ReviewRef => {
  const repoRef = getUniqueRepoRef();
  const repoFullName = overrides?.repoFullName ?? repoRef.fullName;
  const prNumber = overrides?.prNumber ?? getUniqueInt();
  const commentId = overrides?.commentId ?? getUniqueInt();
  const commentUrl = `https://github.com/${repoFullName}/pull/${prNumber}#issuecomment-${commentId}`;

  return { repoFullName, owner: repoRef.owner, repo: repoRef.repo, prNumber, commentId, commentUrl };
};
