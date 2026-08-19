import type { ParsedCommentUrl } from './types/index.js';

export const parseCommentUrl = (url: string): ParsedCommentUrl | undefined => {
  const match = url.match(/^https:\/\/github\.com\/([^/]+)\/([^/]+)\/(?:issues|pull)\/\d+#issuecomment-(\d+)$/);
  if (!match) return undefined;
  const [, owner, repo, commentId] = match;
  return { owner, repo, commentId: parseInt(commentId, 10) };
};
