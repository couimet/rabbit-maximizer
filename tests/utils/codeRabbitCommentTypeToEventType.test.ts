import { CodeRabbitCommentType } from '../../src/types/CodeRabbitCommentType.js';
import { codeRabbitCommentTypeToEventType } from '../../src/utils/codeRabbitCommentTypeToEventType.js';

import { describe, expect, it } from '@jest/globals';

describe('codeRabbitCommentTypeToEventType', () => {
  it('returns coderabbit_review_approved for review_approved', () => {
    expect(codeRabbitCommentTypeToEventType(CodeRabbitCommentType.review_approved)).toBe('coderabbit_review_approved');
  });

  it('returns coderabbit_review_changes_suggested for review_changes_suggested', () => {
    expect(codeRabbitCommentTypeToEventType(CodeRabbitCommentType.review_changes_suggested)).toBe('coderabbit_review_changes_suggested');
  });

  it('throws for review_limited via forUnexpectedSwitchDefault', () => {
    expect(() => codeRabbitCommentTypeToEventType(CodeRabbitCommentType.review_limited)).toThrowDetailedError('UNEXPECTED_CODE_PATH', {
      message: 'Unexpected CodeRabbit comment type: "review_limited"',
      functionName: 'codeRabbitCommentTypeToEventType',
      details: { unexpectedValue: CodeRabbitCommentType.review_limited },
    });
  });

  it('throws for review_skipped via forUnexpectedSwitchDefault', () => {
    expect(() => codeRabbitCommentTypeToEventType(CodeRabbitCommentType.review_skipped)).toThrowDetailedError('UNEXPECTED_CODE_PATH', {
      message: 'Unexpected CodeRabbit comment type: "review_skipped"',
      functionName: 'codeRabbitCommentTypeToEventType',
      details: { unexpectedValue: CodeRabbitCommentType.review_skipped },
    });
  });

  it('throws for unknown via forUnexpectedSwitchDefault', () => {
    expect(() => codeRabbitCommentTypeToEventType(CodeRabbitCommentType.unknown)).toThrowDetailedError('UNEXPECTED_CODE_PATH', {
      message: 'Unexpected CodeRabbit comment type: "unknown"',
      functionName: 'codeRabbitCommentTypeToEventType',
      details: { unexpectedValue: CodeRabbitCommentType.unknown },
    });
  });
});
