import type { operations } from '../api-types.js';

import { MS_PER_DAY } from './durations.js';

export type Duration = NonNullable<NonNullable<operations['getSummary']['parameters']['query']>['duration']>;

export const DEFAULT_DURATION: Duration = '24h';

export const DURATION_OPTIONS: { value: Duration; label: string }[] = [
  { value: '24h', label: 'Last 24h' },
  { value: '2d', label: 'Last 2d' },
  { value: '3d', label: 'Last 3d' },
  { value: '5d', label: 'Last 5d' },
  { value: '1w', label: 'Last 1w' },
];

const DURATION_MS: Record<Duration, number> = {
  '24h': MS_PER_DAY,
  '2d': 2 * MS_PER_DAY,
  '3d': 3 * MS_PER_DAY,
  '5d': 5 * MS_PER_DAY,
  '1w': 7 * MS_PER_DAY,
};

const isDuration = (value: string): value is Duration => Object.hasOwn(DURATION_MS, value);

export const resolveDurationSince = (rawQuery: unknown): Date => {
  const rawDuration = typeof rawQuery === 'string' ? rawQuery : '';
  const duration: Duration = isDuration(rawDuration) ? rawDuration : DEFAULT_DURATION;
  return new Date(Date.now() - DURATION_MS[duration]);
};
