import type { DetectedComment } from '../../src/types/DetectedComment.js';
import { CodeRabbitCommentType } from '../../src/types/index.js';

import { getRandomEnumValue, getRandomString, getUniqueDate, getUniqueGitHubRepoRef, getUniqueInt, getUniqueString } from '@couimet/dynamic-testing';

export const makeDetectedComment = (overrides: Record<string, unknown> = {}): DetectedComment => {
  const repoFullName = (overrides.repoFullName as string | undefined) ?? getUniqueGitHubRepoRef().fullName;
  const prNumber = (overrides.prNumber as number | undefined) ?? getUniqueInt();
  const commentId = (overrides.commentId as number | undefined) ?? getUniqueInt();
  const { repoFullName: _repoFullName, prNumber: _prNumber, commentId: _commentId, ...rest } = overrides;
  return {
    url: `https://github.com/${repoFullName}/issues/${prNumber}#issuecomment-${commentId}`,
    repoFullName,
    prNumber,
    prTitle: getUniqueString({ prefix: 'pr-title-' }),
    body: getRandomString(),
    commentType: getRandomEnumValue(CodeRabbitCommentType),
    commentId,
    createdAt: getUniqueDate().toISOString(),
    updatedAt: getUniqueDate().toISOString(),
    ...rest,
  };
};
