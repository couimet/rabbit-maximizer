import { QueueStatus } from '../../src/types/QueueStatus.js';
import { TriggerSource } from '../../src/types/TriggerSource.js';

import { makeReviewRef } from './makeReviewRef.js';

import { getRandomEnumValue, getUniqueDate, getUniqueInt, getUuid } from '@couimet/dynamic-testing';

export const makeQueueItem = (overrides: Record<string, unknown> = {}) => {
  const ref = makeReviewRef({
    repoFullName: overrides.repo_full_name as string | undefined,
    prNumber: overrides.pr_number as number | undefined,
    commentId: overrides.source_comment_id as number | undefined,
  });
  const { repo_full_name: _rf, pr_number: _pn, source_comment_id: _ci, ...rest } = overrides;
  return {
    id: getUniqueInt(),
    uuid: getUuid(),
    repo_full_name: ref.repoFullName,
    pr_number: ref.prNumber,
    pr_title: `Test PR ${ref.prNumber}`,
    status: getRandomEnumValue(QueueStatus),
    attempts: 0,
    source_comment_id: ref.commentId,
    source_comment_url: ref.commentUrl,
    trigger_source: getRandomEnumValue(TriggerSource),
    pull_request_id: getUniqueInt(),
    created_at: getUniqueDate(),
    updated_at: getUniqueDate(),
    ...rest,
  };
};
