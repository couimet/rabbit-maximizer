import type { CreateSkippedData } from '../../src/types/index.js';

import { getUniqueGitHubRepoRef, getUniqueInt, getUniqueString } from '@couimet/dynamic-testing';

export const makeCreateSkippedData = (overrides?: Partial<CreateSkippedData>): CreateSkippedData => {
  const repo = overrides?.repo ?? getUniqueGitHubRepoRef().fullName;
  const pr = overrides?.pr ?? getUniqueInt();
  const sourceCommentId = overrides?.sourceCommentId ?? getUniqueInt();
  return {
    repo,
    pr,
    prTitle: overrides?.prTitle ?? getUniqueString({ prefix: 'pr-title-' }),
    sourceCommentUrl: overrides?.sourceCommentUrl ?? `https://github.com/${repo}/issues/${pr}#issuecomment-${sourceCommentId}`,
    sourceCommentId,
    pullRequestId: overrides?.pullRequestId ?? getUniqueInt(),
  };
};
