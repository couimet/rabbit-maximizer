/** Columns read by the scanner when comparing the stored head sha against the PR's current head. */
export interface PullRequestHeadSha {
  readonly id: number;
  readonly head_sha: string | null;
}
