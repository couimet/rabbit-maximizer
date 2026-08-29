import { formatElapsed } from './index.js';

import { useEffect, useState } from 'react';

const COUNTDOWN_TICK_MS = 1_000;

const formatCountdown = (diffMs: number): { h: number; m: number; s: number } => {
  const totalSec = Math.floor(diffMs / 1_000);
  const h = Math.floor(totalSec / 3_600);
  const m = Math.floor((totalSec % 3_600) / 60);
  const s = totalSec % 60;
  return { h, m, s };
};

const ReviewCountdown = ({
  target,
  paused,
  onTogglePaused,
  toggling,
  schedulerStale,
  lastSchedulerTickAt,
}: {
  target: Date | null;
  paused: boolean;
  onTogglePaused: () => void;
  toggling: boolean;
  schedulerStale: boolean;
  lastSchedulerTickAt: string | null;
}) => {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), COUNTDOWN_TICK_MS);
    return () => clearInterval(id);
  }, [target]);

  const diffMs = target === null ? 0 : target.getTime() - now;
  const available = diffMs <= 0;

  const barClass = schedulerStale ? 'countdown-bar stale' : paused ? 'countdown-bar paused' : available ? 'countdown-bar available' : 'countdown-bar waiting';
  const dotClass = schedulerStale ? 'countdown-dot stale' : paused ? 'countdown-dot paused' : available ? 'countdown-dot available' : 'countdown-dot waiting';

  const countdownText = schedulerStale
    ? (() => {
        const elapsed = formatElapsed(lastSchedulerTickAt);
        return elapsed !== null ? `No heartbeat for ${elapsed}` : 'No heartbeat yet';
      })()
    : available
      ? 'Available now'
      : (() => {
          const { h, m, s } = formatCountdown(diffMs);
          return `${h}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`;
        })();

  return (
    <div className={barClass}>
      <div className="countdown-status">
        <div className={dotClass} />
        <span className="countdown-label">{schedulerStale ? 'Status unknown' : paused ? 'Paused' : 'Next review'}</span>
        <span className={schedulerStale ? 'countdown-value stale' : `countdown-value${available ? ' available' : ''}`}>{countdownText}</span>
      </div>
      <button
        className="countdown-toggle"
        onClick={onTogglePaused}
        disabled={toggling || schedulerStale}
        title={schedulerStale ? 'Scheduler is unreachable' : undefined}
        aria-label={paused ? 'Resume scheduler' : 'Pause scheduler'}
      >
        {toggling ? '…' : paused ? 'Resume' : 'Pause'}
      </button>
    </div>
  );
};

export default ReviewCountdown;
