import type { CodeRabbitCommentType } from './CodeRabbitCommentType.js';

import type { CoderabbitComment } from '@prisma/client';

export interface EditDetectionResult {
  readonly wasEdited: boolean;
  readonly newClassification: CodeRabbitCommentType;
  readonly updatedComment: CoderabbitComment;
}
