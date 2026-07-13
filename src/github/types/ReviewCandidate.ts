/* c8 ignore start — interface-only file; v8 counts export declarations as uncovered statements */
export interface ReviewCandidate {
  readonly user?: { readonly login?: string } | null;
  readonly body?: string | null;
  readonly submitted_at?: string | null;
}
/* c8 ignore stop */
