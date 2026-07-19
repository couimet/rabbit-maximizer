import type { CoderabbitCommentRow } from '../db/coderabbitCommentRepository.js';

import type { CommentClassification } from './CommentClassification.js';

export interface EditDetectionResult {
  readonly wasEdited: boolean;
  readonly newClassification?: CommentClassification;
  readonly updatedCommentRow?: CoderabbitCommentRow;
}
