import type { ReopenCandidate } from '../types/index.js';

export const shouldReopenStaleRetriggered = (
  item: ReopenCandidate,
  headSha: string | undefined,
  reviewedHeadSha: string | undefined,
  lookbackMs: number,
  now: Date,
): boolean =>
  headSha !== undefined &&
  reviewedHeadSha !== undefined &&
  headSha !== reviewedHeadSha &&
  item.retriggered_at != null &&
  item.retriggered_at.getTime() < now.getTime() - lookbackMs;
