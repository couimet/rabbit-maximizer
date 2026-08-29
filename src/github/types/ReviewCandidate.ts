export interface ReviewCandidate {
  readonly user?: { readonly login?: string } | null;
  readonly body?: string | null;
  readonly submitted_at?: string | null;
}
