export const CODERABBIT_REVIEW_APPROVED = 'approved';
export const CODERABBIT_REVIEW_CHANGES_REQUESTED = 'changes_requested';

export type CoderabbitReviewState = typeof CODERABBIT_REVIEW_APPROVED | typeof CODERABBIT_REVIEW_CHANGES_REQUESTED;

/* c8 ignore start — interface-only file; v8 counts export declarations as uncovered statements */
export interface CoderabbitReview {
  readonly htmlUrl: string;
  readonly state: CoderabbitReviewState;
}
/* c8 ignore stop */
