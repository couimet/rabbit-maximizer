export interface CommentDetails {
  readonly commentId: number;
  readonly commentUrl: string;
  /** CodeRabbit per-comment Run ID of the replacement comment, adopted by reschedule so review matching tracks the freshest run. */
  readonly coderabbitRunId?: string;
}
