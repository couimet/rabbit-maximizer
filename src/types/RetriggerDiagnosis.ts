import type { CommentDiagnosis } from './CommentDiagnosis.js';
import type { RetriggerDecision } from './RetriggerDecision.js';

/** Full retrigger diagnosis payload attached to scheduler retrigger comments. */
export interface RetriggerDiagnosis {
  readonly sourceComment: CommentDiagnosis;
  readonly replacementComment?: CommentDiagnosis;
  readonly waitSeconds: number | undefined;
  readonly decision: RetriggerDecision;
}
