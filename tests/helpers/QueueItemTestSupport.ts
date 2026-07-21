import type { QueueItem } from '../../src/types/QueueItem.js';
import { QueueStatus } from '../../src/types/QueueStatus.js';
import { TriggerSource } from '../../src/types/TriggerSource.js';

import { generateReviewRef } from './ReviewRefTestSupport.js';

import { getRandomEnumValue, getUniqueDate, getUniqueInt, getUuid } from '@couimet/dynamic-testing';

export const generateQueueItemHydrationData = (overrideValues?: Partial<QueueItem>): QueueItem => {
  const ref = generateReviewRef({
    repoFullName: overrideValues?.repo_full_name,
    prNumber: overrideValues?.pr_number,
    commentId: overrideValues?.source_comment_id,
  });
  const { repo_full_name: _rf, pr_number: _pn, source_comment_id: _ci, ...rest } = overrideValues ?? {};
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
