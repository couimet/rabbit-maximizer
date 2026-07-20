import { REVIEW_BOT_NO_ACTIONABLE_SIGNAL } from '../types/coderabbit.js';

export const isApprovalReviewSignal = (body: string): boolean => body.includes(REVIEW_BOT_NO_ACTIONABLE_SIGNAL);
