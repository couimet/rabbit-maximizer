/**
 * An open pull request whose head commit the recorded review does not cover. The
 * candidate query over-reaches on purpose: `reviewedHeadSha` is a cheap first pass,
 * and the reviews API decides the outcome for each candidate.
 */
export interface UnreviewedHeadPR {
  readonly id: number;
  readonly repoFullName: string;
  readonly prNumber: number;
  readonly title: string;
  readonly authorLogin: string;
  readonly headSha: string;
  readonly headCommittedAt: Date;
  /** The head that the last recorded review covered. `null` when no review recorded a head. */
  readonly reviewedHeadSha: string | null;
}
