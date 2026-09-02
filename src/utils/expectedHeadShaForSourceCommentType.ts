import { CodeRabbitCommentType } from '../domain.js';

export const expectedHeadShaForSourceCommentType = (sourceCommentType: CodeRabbitCommentType | undefined, headSha: string | undefined): string | undefined =>
  sourceCommentType === CodeRabbitCommentType.review_skipped ? headSha : undefined;
