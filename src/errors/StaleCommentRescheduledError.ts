import type { CommentDetails, CommentDiagnosis } from '../types/index.js';

import { RabbitMaximizerError } from './RabbitMaximizerError.js';
import { RabbitMaximizerErrorCodes } from './RabbitMaximizerErrorCodes.js';

export class StaleCommentRescheduledError extends RabbitMaximizerError {
  constructor(
    readonly sourceComment: CommentDetails,
    readonly originalSource: CommentDiagnosis,
    readonly rescheduleEarliest: Date,
    functionName: string,
  ) {
    super({
      code: RabbitMaximizerErrorCodes.RETRIGGER_STALE_COMMENT_RESCHEDULE,
      message: 'Source comment was replaced; item must be rescheduled',
      functionName,
    });
    this.name = 'StaleCommentRescheduledError';
  }
}
