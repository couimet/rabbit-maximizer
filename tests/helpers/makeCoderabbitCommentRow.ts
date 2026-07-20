import type { CoderabbitCommentRow } from '../../src/db/coderabbitCommentRepository.js';
import { CodeRabbitCommentType } from '../../src/types/CodeRabbitCommentType.js';

import { makeReviewRef } from './makeReviewRef.js';

import { getUniqueInt, getUuid } from '@couimet/dynamic-testing';

export const makeCoderabbitCommentRow = (overrides?: Partial<CoderabbitCommentRow>): CoderabbitCommentRow => {
  const ref = makeReviewRef({ commentId: overrides?.comment_id });
  return {
    id: getUniqueInt(),
    uuid: getUuid(),
    pull_request_id: getUniqueInt(),
    comment_id: ref.commentId,
    url: ref.commentUrl,
    comment_type: CodeRabbitCommentType.review_approved,
    last_body_preview: null,
    gh_created_at: new Date(),
    gh_updated_at: new Date(),
    first_seen_at: new Date(),
    last_seen_at: new Date(),
    ...overrides,
  } as CoderabbitCommentRow;
};
