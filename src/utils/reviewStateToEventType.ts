import { EventType } from '../domain.js';
import { CODERABBIT_REVIEW_APPROVED, type CoderabbitReviewState } from '../github/index.js';

export const reviewStateToEventType = (state: CoderabbitReviewState): EventType.coderabbit_review_approved | EventType.coderabbit_review_changes_suggested =>
  state === CODERABBIT_REVIEW_APPROVED ? EventType.coderabbit_review_approved : EventType.coderabbit_review_changes_suggested;
