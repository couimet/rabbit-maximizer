import type { CommentDiagnosis } from './CommentDiagnosis.js';
import type { RetriggerDecision } from './RetriggerDecision.js';

export interface RetriggerDiagnosis {
  readonly sourceComment: CommentDiagnosis;
  readonly replacementComment?: CommentDiagnosis;
  readonly waitSeconds: number | undefined;
  readonly decision: RetriggerDecision;
}
