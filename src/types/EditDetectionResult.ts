import type { CoderabbitCommentRow } from '../db/coderabbitCommentRepository.js';

import { CodeRabbitCommentType } from './CodeRabbitCommentType.js';

export interface EditDetectionResult {
  readonly wasEdited: boolean;
  readonly newClassification: CodeRabbitCommentType;
  readonly updatedCommentRow: CoderabbitCommentRow;
}
