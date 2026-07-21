import type { ReviewCandidate } from '../../src/github/types/index.js';

import { getUniqueDate, getUniqueInt } from '@couimet/dynamic-testing';

export const generateReviewCandidateHydrationData = (overrideValues?: Partial<ReviewCandidate>): ReviewCandidate => {
  return {
    user: { login: 'coderabbitai[bot]' },
    body: `**Actionable comments posted: ${getUniqueInt()}`,
    submitted_at: getUniqueDate().toISOString(),
    ...overrideValues,
  };
};
