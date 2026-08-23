export interface SubmittedReviewFields {
  readonly userLogin: string | undefined;
  readonly body: string | undefined;
  readonly submittedAt: string | undefined;
  readonly commitId: string | undefined;
  readonly state?: string;
}
