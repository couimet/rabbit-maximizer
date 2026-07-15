import { REVIEW_BOT_ACKNOWLEDGEMENT_MARKER, REVIEW_BOT_LOGIN } from '../types/coderabbit.js';

export const isAcknowledgementComment = (comment: { user?: { login?: string } | null; body?: string }): boolean =>
  comment.user?.login === REVIEW_BOT_LOGIN && comment.body !== undefined && comment.body.includes(REVIEW_BOT_ACKNOWLEDGEMENT_MARKER);
