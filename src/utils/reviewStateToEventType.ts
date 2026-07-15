import { CODERABBIT_REVIEW_APPROVED, type CoderabbitReviewState } from '../github/types/CoderabbitReview.js';
import { EventType } from '../types/index.js';

export const reviewStateToEventType = (state: CoderabbitReviewState): EventType.coderabbit_review_approved | EventType.coderabbit_review_changes_requested =>
  state === CODERABBIT_REVIEW_APPROVED ? EventType.coderabbit_review_approved : EventType.coderabbit_review_changes_requested;
