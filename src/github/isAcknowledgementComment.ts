import { findPhrase } from '../utils/index.js';

import { REVIEW_BOT_LOGIN, SubmittedComment } from './index.js';

/** True when the bot wrote the comment and the body holds one of the configured acknowledgement phrases. */
export const isAcknowledgementComment = (comment: SubmittedComment, phrases: readonly string[]): boolean =>
  comment.userLogin === REVIEW_BOT_LOGIN && comment.body !== undefined && findPhrase(comment.body, phrases) !== undefined;
