import type { DetectedComment } from '../../src/types/DetectedComment.js';
import { CodeRabbitCommentType } from '../../src/types/index.js';

import { generateReviewRef } from './ReviewRefTestSupport.js';

import { getRandomEnumValue, getRandomString, getUniqueDate, getUniqueString } from '@couimet/dynamic-testing';

export const generateDetectedCommentHydrationData = (overrideValues?: Partial<DetectedComment>): DetectedComment => {
  const ref = generateReviewRef({
    repoFullName: overrideValues?.repoFullName,
    prNumber: overrideValues?.prNumber,
    commentId: overrideValues?.commentId,
  });
  const { repoFullName: _rf, prNumber: _pn, commentId: _ci, ...rest } = overrideValues ?? {};
  return {
    url: ref.commentUrl,
    repoFullName: ref.repoFullName,
    prNumber: ref.prNumber,
    prTitle: getUniqueString({ prefix: 'pr-title-' }),
    body: getRandomString(),
    commentType: getRandomEnumValue(CodeRabbitCommentType),
    commentId: ref.commentId,
    createdAt: getUniqueDate().toISOString(),
    updatedAt: getUniqueDate().toISOString(),
    ...rest,
  };
};
