export interface ReviewLimitComment {
  readonly url: string;
  readonly repoFullName: string;
  readonly prNumber: number;
  readonly commentId: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}
