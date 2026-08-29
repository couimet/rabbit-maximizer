export interface ListedComment {
  readonly body: string;
  readonly user: string;
  readonly id: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}
