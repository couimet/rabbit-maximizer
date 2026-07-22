import type { CoderabbitComment } from '../db/index.js';
import { CodeRabbitCommentType } from '../github/index.js';

export interface EditDetectionResult {
  readonly wasEdited: boolean;
  readonly newClassification: CodeRabbitCommentType;
  readonly updatedComment: CoderabbitComment;
}
