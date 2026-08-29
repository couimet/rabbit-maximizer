import { MS_PER_SECOND, SECONDS_PER_HOUR, SECONDS_PER_MINUTE } from '../../../src/utils/index.js';

export const formatElapsed = (lastSchedulerTickAt: string | null): string | null => {
  if (!lastSchedulerTickAt) return null;
  const elapsedMs = Date.now() - new Date(lastSchedulerTickAt).getTime();
  const elapsedSec = Math.floor(elapsedMs / MS_PER_SECOND);
  if (elapsedSec < SECONDS_PER_MINUTE) return `${elapsedSec} second${elapsedSec === 1 ? '' : 's'}`;
  if (elapsedSec < SECONDS_PER_HOUR) {
    const minutes = Math.floor(elapsedSec / SECONDS_PER_MINUTE);
    return `${minutes} minute${minutes === 1 ? '' : 's'}`;
  }
  const hours = Math.floor(elapsedSec / SECONDS_PER_HOUR);
  return `${hours} hour${hours === 1 ? '' : 's'}`;
};
