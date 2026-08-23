export interface SubmittedReviewRaw {
  readonly user?: { readonly login?: string } | null;
  readonly body?: string | null;
  readonly submitted_at?: string | null;
  readonly commit_id?: string | null;
  readonly state?: string;
}
