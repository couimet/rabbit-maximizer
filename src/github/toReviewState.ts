import { RabbitMaximizerError } from '../errors/index.js';

import { CODERABBIT_REVIEW_APPROVED, CODERABBIT_REVIEW_CHANGES_REQUESTED, type CoderabbitReviewState } from './index.js';

const GITHUB_REVIEW_STATE_TO_DOMAIN: Record<string, CoderabbitReviewState> = {
  APPROVED: CODERABBIT_REVIEW_APPROVED,
  CHANGES_REQUESTED: CODERABBIT_REVIEW_CHANGES_REQUESTED,
};

export const toReviewState = (githubState: string): CoderabbitReviewState => {
  const mapped = GITHUB_REVIEW_STATE_TO_DOMAIN[githubState];
  if (mapped !== undefined) return mapped;
  throw RabbitMaximizerError.forUnexpectedSwitchDefault('GitHub review state', githubState, 'toReviewState');
};

export const hasKnownReviewState = (githubState: string): boolean => GITHUB_REVIEW_STATE_TO_DOMAIN[githubState] !== undefined;
