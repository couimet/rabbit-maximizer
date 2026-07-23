import type { DirectCheckPR, ScannedPR, StaleOpenPR } from '../types/index.js';

/**
 * Merge scanned and stale PR lists, deduplicating by pullRequestId.
 * StaleOpenPR uses `id`; ScannedPR uses `pullRequestId`.
 */
export const mergeByPullRequestId = (scanned: readonly ScannedPR[], stale: readonly StaleOpenPR[]): DirectCheckPR[] => {
  const seen = new Set<number>();
  const merged: DirectCheckPR[] = [];

  for (const pr of scanned) {
    if (!seen.has(pr.pullRequestId)) {
      seen.add(pr.pullRequestId);
      merged.push({ repoFullName: pr.repoFullName, prNumber: pr.prNumber, pullRequestId: pr.pullRequestId, prTitle: pr.prTitle });
    }
  }
  for (const pr of stale) {
    if (!seen.has(pr.id)) {
      seen.add(pr.id);
      merged.push({ repoFullName: pr.repoFullName, prNumber: pr.prNumber, pullRequestId: pr.id, prTitle: pr.title });
    }
  }

  return merged;
};
