import { QueueStatus, TriggerSource } from '../../src/types/index.js';

import { buildCommentUrl, generateReviewRef } from './ReviewRefTestSupport.js';

import { getRandomEnumValue, getUniqueDate, getUniqueInt, getUniqueString, getUuid } from '@couimet/dynamic-testing';
import type { ReviewQueue } from '@prisma/client';

export const generateReviewQueueHydrationData = (overrideValues?: Partial<ReviewQueue>): ReviewQueue => {
  const ref = generateReviewRef({
    repoFullName: overrideValues?.repo_full_name,
    prNumber: overrideValues?.pr_number,
    commentId: overrideValues?.source_comment_id,
  });
  const { repo_full_name: _rf, pr_number: _pn, source_comment_id: _ci, source_comment_url: _cu, ...rest } = overrideValues ?? {};
  return {
    id: getUniqueInt(),
    uuid: getUuid(),
    repo_full_name: ref.repoFullName,
    pr_number: ref.prNumber,
    pr_title: getUniqueString({ prefix: 'pr-title-' }),
    status: getRandomEnumValue(QueueStatus),
    attempts: getUniqueInt(),
    source_comment_url: buildCommentUrl(ref.repoFullName, ref.prNumber, getUniqueInt()),
    source_comment_id: ref.commentId,
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
