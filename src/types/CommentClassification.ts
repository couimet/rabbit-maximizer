import type { CodeRabbitCommentType } from '../domain.js';

/** A permanent refusal always names the configured refusal phrase the body holds. */
export interface RefusedCommentClassification {
  readonly classification: CodeRabbitCommentType.review_refused;
  readonly matchedPhrase: string;
  readonly matchedOffset: number;
}

/** Every other classification carries a phrase only when a configured phrase decided it. */
export interface OtherCommentClassification {
  readonly classification: Exclude<CodeRabbitCommentType, CodeRabbitCommentType.review_refused>;
  readonly matchedPhrase: string | undefined;
  readonly matchedOffset: number | undefined;
}

/** Classification result with the configured phrase that drove it, and that phrase's offset. */
export type CommentClassification = RefusedCommentClassification | OtherCommentClassification;
