import { REVIEW_BOT_ACKNOWLEDGEMENT_MARKER, REVIEW_BOT_LOGIN } from '../types/coderabbit.js';

import { SubmittedComment } from './index.js';

export const isAcknowledgementComment = (comment: SubmittedComment): boolean =>
  comment.userLogin === REVIEW_BOT_LOGIN && comment.body !== undefined && comment.body.includes(REVIEW_BOT_ACKNOWLEDGEMENT_MARKER);
