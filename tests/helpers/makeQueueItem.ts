import { QueueStatus } from '../../src/types/QueueStatus.js';
import { TriggerSource } from '../../src/types/TriggerSource.js';

import { getRandomEnumValue, getUniqueDate, getUniqueInt, getUniqueRepoRef, getUuid, type UniqueRepoRef } from '@couimet/dynamic-testing';

export const makeQueueItem = (overrides: Record<string, unknown> = {}) => {
  const prNumber = (overrides.pr_number as number | undefined) ?? getUniqueInt();
  const repoRef = (overrides.repo_ref as UniqueRepoRef | undefined) ?? getUniqueRepoRef();
  const commentId = (overrides.source_comment_id as number | undefined) ?? getUniqueInt();
  const { pr_number: _prNumber, repo_ref: _repoRef, source_comment_id: _sourceCommentId, ...rest } = overrides;
  return {
    id: getUniqueInt(),
    uuid: getUuid(),
    repo_full_name: repoRef.fullName,
    pr_number: prNumber,
    pr_title: `Test PR ${prNumber}`,
    status: getRandomEnumValue(QueueStatus),
    attempts: 0,
    source_comment_id: commentId,
    source_comment_url: `https://github.com/${repoRef.owner}/${repoRef.repo}/pull/${prNumber}#discussion_r${commentId}`,
    trigger_source: getRandomEnumValue(TriggerSource),
    pull_request_id: getUniqueInt(),
    created_at: getUniqueDate(),
    updated_at: getUniqueDate(),
    ...rest,
  };
};
