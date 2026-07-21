import { QueueStatus, TriggerSource } from '../../src/types/index.js';

import { getRandomEnumValue, getUniqueDate, getUniqueGitHubRepoRef, getUniqueInt, getUniqueString, getUuid } from '@couimet/dynamic-testing';
import type { ReviewQueue } from '@prisma/client';

export const makeReviewQueueRow = (over?: Partial<ReviewQueue>): ReviewQueue => {
  const commentId = getUniqueInt();
  const repoFullName = over?.repo_full_name ?? getUniqueGitHubRepoRef().fullName;
  const prNumber = over?.pr_number ?? getUniqueInt();
  const sourceCommentId = over?.source_comment_id ?? commentId;
  const {
    repo_full_name: _repoFullName,
    pr_number: _prNumber,
    source_comment_id: _sourceCommentId,
    source_comment_url: _sourceCommentUrl,
    ...rest
  } = over ?? {};
  return {
    id: getUniqueInt(),
    uuid: getUuid(),
    repo_full_name: repoFullName,
    pr_number: prNumber,
    pr_title: getUniqueString({ prefix: 'pr-title-' }),
    status: getRandomEnumValue(QueueStatus),
    attempts: getUniqueInt(),
    source_comment_url: `https://github.com/${repoFullName}/issues/${prNumber}#issuecomment-${sourceCommentId}`,
    source_comment_id: sourceCommentId,
    trigger_source: getRandomEnumValue(TriggerSource),
    retrigger_comment_url: null,
    retriggered_at: getUniqueDate(),
    failed_at: getUniqueDate(),
    reviewed_at: getUniqueDate(),
    pull_request_id: getUniqueInt(),
    created_at: getUniqueDate(),
    updated_at: getUniqueDate(),
    ...rest,
  };
};
