const APPROVAL_SIGNAL = 'No actionable comments were generated in the recent review.';

export const isApprovalReviewSignal = (body: string): boolean => body.includes(APPROVAL_SIGNAL);
