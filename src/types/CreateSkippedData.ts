export interface CreateSkippedData {
  readonly repo: string;
  readonly pr: number;
  readonly prTitle: string;
  readonly sourceCommentUrl: string;
  readonly sourceCommentId: number;
  readonly pullRequestId: number;
}
