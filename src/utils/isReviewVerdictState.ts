import { CodeRabbitCommentType } from '../domain.js';

export const isReviewVerdictState = (
  value: CodeRabbitCommentType | null | undefined,
): value is typeof CodeRabbitCommentType.review_approved | typeof CodeRabbitCommentType.review_changes_suggested =>
  value === CodeRabbitCommentType.review_approved || value === CodeRabbitCommentType.review_changes_suggested;
