import { REVIEW_BOT_COMPLETION_SIGNALS } from '../types/coderabbit.js';

export const isCompletedReview = (body: string): boolean => REVIEW_BOT_COMPLETION_SIGNALS.some((signal) => body.includes(signal));
