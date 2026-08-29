export const buildCommentUrl = (repoFullName: string, prNumber: number, commentId: number): string =>
  `https://github.com/${repoFullName}/pull/${prNumber}#issuecomment-${commentId}`;
