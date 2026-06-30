export const computeSchedulerBackoff = (attempts: number, baseMs: number, maxMs: number): number => Math.min(baseMs * Math.pow(2, attempts), maxMs);
