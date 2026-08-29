import type { FormatRelativeTimeOptions } from '../types/index.js';

import { MS_PER_DAY, MS_PER_HOUR, MS_PER_MINUTE } from './index.js';

const formatParts = (days: number, hours: number, minutes: number, granularity: 'single' | 'compact' | 'full'): string => {
  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);

  if (granularity === 'single') return `${parts[0]} ago`;

  const maxParts = granularity === 'compact' ? 2 : parts.length;
  return `${parts.slice(0, maxParts).join(' ')} ago`;
};

export const formatRelativeTime = (iso: string, opts?: FormatRelativeTimeOptions): string => {
  const now = opts?.now ?? new Date();
  const granularity = opts?.granularity ?? 'single';

  const diffMs = now.getTime() - new Date(iso).getTime();
  if (diffMs < 0) return 'just now';

  const totalMinutes = Math.floor(diffMs / MS_PER_MINUTE);
  if (totalMinutes === 0) return 'just now';

  const days = Math.floor(diffMs / MS_PER_DAY);
  const hours = Math.floor((diffMs % MS_PER_DAY) / MS_PER_HOUR);
  const minutes = Math.floor((diffMs % MS_PER_HOUR) / MS_PER_MINUTE);

  return formatParts(days, hours, minutes, granularity);
};
