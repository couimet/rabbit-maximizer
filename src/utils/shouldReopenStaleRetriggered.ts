import type { ReopenCandidate } from '../types/index.js';

export const shouldReopenStaleRetriggered = (
  item: ReopenCandidate,
  headSha: string | undefined,
  reviewedHeadSha: string | undefined,
  lookbackMs: number,
  now: Date,
): boolean =>
  // A missing reviewed head means no review is recorded for the current head, so it counts as
  // different from headSha (headSha !== undefined guards the all-unknown case).
  headSha !== undefined && headSha !== reviewedHeadSha && item.retriggered_at != null && item.retriggered_at.getTime() < now.getTime() - lookbackMs;
