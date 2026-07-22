import { PrState } from '../../src/domain.js';

import { generateReviewRef } from './ReviewRefTestSupport.js';

import { getRandomEnumValue, getUniqueDate, getUniqueInt, getUniqueString, getUuid } from '@couimet/dynamic-testing';
import type { PullRequest } from '@prisma/client';

export const generatePullRequestHydrationData = (overrideValues?: Partial<PullRequest>): PullRequest => {
  const ref = generateReviewRef({
    repoFullName: overrideValues?.repo_full_name,
    prNumber: overrideValues?.pr_number,
  });
  const { repo_full_name: _rf, pr_number: _pn, ...rest } = overrideValues ?? {};
  return {
    id: getUniqueInt(),
    uuid: getUuid(),
    repo_full_name: ref.repoFullName,
    pr_number: ref.prNumber,
    title: getUniqueString({ prefix: 'pr-title-' }),
    author_login: getUniqueString({ prefix: 'author-' }),
    pr_state: getRandomEnumValue(PrState),
    first_seen_at: getUniqueDate(),
    first_review_limit_at: getUniqueDate(),
    last_review_limit_at: getUniqueDate(),
    last_review_requested_at: getUniqueDate(),
    last_coderabbit_review_at: getUniqueDate(),
    last_coderabbit_acknowledged_at: getUniqueDate(),
    retrigger_count: getUniqueInt(),
    review_count: getUniqueInt(),
    created_at: getUniqueDate(),
    updated_at: getUniqueDate(),
    ...rest,
  };
};
