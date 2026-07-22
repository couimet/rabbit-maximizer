import { MINUTES_PER_HOUR, MS_PER_HOUR, MS_PER_MINUTE } from './index.js';

export const formatRelativeTime = (iso: string): string => {
  const diffMs = Date.now() - new Date(iso).getTime();
  if (diffMs < 0) return 'just now';
  const diffMin = Math.floor(diffMs / MS_PER_MINUTE);
  if (diffMin === 0) return 'just now';
  if (diffMin < MINUTES_PER_HOUR) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMs / MS_PER_HOUR);
  return `${diffHr}h ago`;
};
