import type { TrackedPrRow } from '../../src/types/index.js';

import { generateReviewRef } from './ReviewRefTestSupport.js';

import { getUniqueDate, getUniqueInt } from '@couimet/dynamic-testing';

export const generateTrackedPrRow = (overrideValues?: Partial<TrackedPrRow>): TrackedPrRow => {
  const ref = generateReviewRef({
    repoFullName: overrideValues?.repo_full_name,
    prNumber: overrideValues?.pr_number,
  });
  const { repo_full_name: _rf, pr_number: _pn, ...rest } = overrideValues ?? {};
  return {
    id: getUniqueInt(),
    title: `Test PR ${ref.prNumber}`,
    repo_full_name: ref.repoFullName,
    pr_number: ref.prNumber,
    author_login: `author-${getUniqueInt()}`,
    last_review_state: null,
    last_coderabbit_review_at: getUniqueDate(),
    ...rest,
  };
};
