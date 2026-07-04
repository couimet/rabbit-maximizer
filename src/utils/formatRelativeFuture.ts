import { HOURS_PER_DAY, MINUTES_PER_HOUR, MS_PER_MINUTE } from './durations.js';

export const formatRelativeFuture = (iso: string): string => {
  const diffMs = new Date(iso).getTime() - Date.now();
  if (diffMs <= 0) return 'eligible now';
  const totalMin = Math.floor(diffMs / MS_PER_MINUTE);
  if (totalMin < MINUTES_PER_HOUR) return `in ${totalMin}m`;
  const hrs = Math.floor(totalMin / MINUTES_PER_HOUR);
  const mins = totalMin % MINUTES_PER_HOUR;
  if (hrs < HOURS_PER_DAY) return mins > 0 ? `in ${hrs}h ${mins}m` : `in ${hrs}h`;
  const days = Math.floor(hrs / HOURS_PER_DAY);
  return `in ${days}d ${hrs % HOURS_PER_DAY}h`;
};
