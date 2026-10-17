import type { CodeRabbitCommentType } from '../domain.js';

/** Diagnosis for a single comment in the retrigger decision trail. */
export interface CommentDiagnosis {
  readonly url: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly classification: CodeRabbitCommentType;
  /** The configured phrase that decided the classification; undefined when no phrase matched. */
  readonly matchedPhrase: string | undefined;
  /** Zero-based index of the matched phrase in the body; undefined when no phrase matched. */
  readonly matchedOffset: number | undefined;
}
