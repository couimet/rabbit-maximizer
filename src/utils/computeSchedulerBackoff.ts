const BACKOFF_MULTIPLIER = 2;

export const computeSchedulerBackoff = (attempts: number, baseMs: number, maxMs: number): number =>
  Math.min(baseMs * Math.pow(BACKOFF_MULTIPLIER, attempts), maxMs);
