import type { CodeRabbitCommentType, MatchedMarker } from '../domain.js';

interface CommentClassificationBase {
  /** The marker constant name that drove the classification; undefined when no marker matched. */
  readonly matchedMarker: MatchedMarker | undefined;
}

/** A permanent refusal always names the configured refusal phrase the body contains. */
export interface RefusedCommentClassification extends CommentClassificationBase {
  readonly classification: CodeRabbitCommentType.review_refused;
  readonly matchedPhrase: string;
}

/** Every other classification carries no refusal phrase. */
export interface OtherCommentClassification extends CommentClassificationBase {
  readonly classification: Exclude<CodeRabbitCommentType, CodeRabbitCommentType.review_refused>;
  readonly matchedPhrase: undefined;
}

/** Classification result with the marker constant name that drove it. */
export type CommentClassification = RefusedCommentClassification | OtherCommentClassification;
