export interface DirectCheckPR {
  readonly repoFullName: string;
  readonly prNumber: number;
  readonly pullRequestId: number;
  readonly prTitle: string;
}
