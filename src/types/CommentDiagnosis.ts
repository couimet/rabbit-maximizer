import type { CodeRabbitCommentType, MatchedMarker } from '../domain.js';

/** Diagnosis for a single comment in the retrigger decision trail. */
export interface CommentDiagnosis {
  readonly url: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly classification: CodeRabbitCommentType;
  readonly matchedMarker: MatchedMarker | undefined;
}
