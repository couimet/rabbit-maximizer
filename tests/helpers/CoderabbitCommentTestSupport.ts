import type { CoderabbitComment, UpsertCommentData } from '../../src/db/coderabbitCommentRepository.js';
import { CodeRabbitCommentType } from '../../src/types/CodeRabbitCommentType.js';

import { generateReviewRef } from './ReviewRefTestSupport.js';

import { getRandomEnumValue, getUniqueDate, getUniqueInt, getUniqueString, getUuid } from '@couimet/dynamic-testing';

export const generateCoderabbitCommentCreationData = (overrideValues?: Partial<UpsertCommentData>): UpsertCommentData => {
  const ref = generateReviewRef({ commentId: overrideValues?.comment_id });
  return {
    comment_id: ref.commentId,
    pull_request_id: getUniqueInt(),
    url: ref.commentUrl,
    comment_type: getRandomEnumValue(CodeRabbitCommentType),
    body: getUniqueString(),
    gh_created_at: getUniqueDate(),
    gh_updated_at: getUniqueDate(),
    ...overrideValues,
  };
};

export const generateCoderabbitCommentHydrationData = (overrideValues?: Partial<CoderabbitComment>): CoderabbitComment => {
  const creationData = generateCoderabbitCommentCreationData({
    comment_id: overrideValues?.comment_id,
    pull_request_id: overrideValues?.pull_request_id,
    url: overrideValues?.url,
    comment_type: overrideValues?.comment_type as CodeRabbitCommentType | undefined,
    body: overrideValues?.last_body_preview ?? undefined,
  });
  return {
    id: getUniqueInt(),
    uuid: getUuid(),
    pull_request_id: creationData.pull_request_id,
    comment_id: creationData.comment_id,
    url: creationData.url,
    comment_type: creationData.comment_type,
    last_body_preview: creationData.body,
    gh_created_at: creationData.gh_created_at,
    gh_updated_at: creationData.gh_updated_at,
    first_seen_at: getUniqueDate(),
    last_seen_at: getUniqueDate(),
    is_not_deleted: true,
    deleted_at: null,
    created_at: getUniqueDate(),
    updated_at: getUniqueDate(),
    ...overrideValues,
  };
};
