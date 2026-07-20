import { RabbitMaximizerError } from '../errors/RabbitMaximizerError.js';
import { CodeRabbitCommentType } from '../types/CodeRabbitCommentType.js';
import { EventType } from '../types/EventType.js';

export const codeRabbitCommentTypeToEventType = (
  type: CodeRabbitCommentType,
): EventType.coderabbit_review_approved | EventType.coderabbit_review_changes_suggested => {
  switch (type) {
    case CodeRabbitCommentType.review_approved:
      return EventType.coderabbit_review_approved;
    case CodeRabbitCommentType.review_changes_suggested:
      return EventType.coderabbit_review_changes_suggested;
    default:
      throw RabbitMaximizerError.forUnexpectedSwitchDefault('CodeRabbit comment type', type, 'codeRabbitCommentTypeToEventType');
  }
};
