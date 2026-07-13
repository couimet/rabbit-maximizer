export interface EnqueueData {
  readonly repo: string;
  readonly pr: number;
  readonly prTitle: string;
  readonly notBefore: Date;
  readonly sourceCommentUrl: string;
  readonly sourceCommentId: number;
  readonly newWait: number;
  readonly pullRequestId: number;
}
