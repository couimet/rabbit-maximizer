import { CodeRabbitCommentType, EventType } from '../domain.js';
import type { CoderabbitReviewVerdictState } from '../types/index.js';

export const toReviewEventType = (
  verdict: CoderabbitReviewVerdictState,
): EventType.coderabbit_review_approved | EventType.coderabbit_review_changes_suggested =>
  verdict === CodeRabbitCommentType.review_approved ? EventType.coderabbit_review_approved : EventType.coderabbit_review_changes_suggested;
