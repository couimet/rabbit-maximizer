import type { CreateSkippedData } from '../../src/types/index.js';

import { generateReviewRef } from './ReviewRefTestSupport.js';

import { getUniqueInt, getUniqueString } from '@couimet/dynamic-testing';

export const generateCreateSkippedData = (overrideValues?: Partial<CreateSkippedData>): CreateSkippedData => {
  const ref = generateReviewRef({ commentId: overrideValues?.sourceCommentId });
  return {
    repo: overrideValues?.repo ?? ref.repoFullName,
    pr: overrideValues?.pr ?? ref.prNumber,
    prTitle: overrideValues?.prTitle ?? getUniqueString({ prefix: 'pr-title-' }),
    sourceCommentUrl: overrideValues?.sourceCommentUrl ?? ref.commentUrl,
    sourceCommentId: ref.commentId,
    pullRequestId: overrideValues?.pullRequestId ?? getUniqueInt(),
  };
};
