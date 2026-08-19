import type { CodeRabbitCommentType, MatchedMarker } from '../domain.js';

/** Classification result with the marker constant name that drove it. */
export interface CommentClassification {
  readonly classification: CodeRabbitCommentType;
  readonly matchedMarker: MatchedMarker | undefined;
}
