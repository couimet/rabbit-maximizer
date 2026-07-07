import { MS_PER_DAY } from './durations.js';

export const DEFAULT_DURATION = '24h';

const DURATION_MS: Record<string, number> = {
  [DEFAULT_DURATION]: MS_PER_DAY,
  '2d': 2 * MS_PER_DAY,
  '3d': 3 * MS_PER_DAY,
  '5d': 5 * MS_PER_DAY,
  '1w': 7 * MS_PER_DAY,
};

export const resolveDurationSince = (rawQuery: unknown): Date => {
  const rawDuration = typeof rawQuery === 'string' ? rawQuery : '';
  const duration = Object.hasOwn(DURATION_MS, rawDuration) ? rawDuration : DEFAULT_DURATION;
  return new Date(Date.now() - DURATION_MS[duration]);
};
