import { useEffect, useState } from 'react';

const COUNTDOWN_TICK_MS = 1_000;

const formatCountdown = (diffMs: number): { h: number; m: number; s: number } => {
  const totalSec = Math.floor(diffMs / 1_000);
  const h = Math.floor(totalSec / 3_600);
  const m = Math.floor((totalSec % 3_600) / 60);
  const s = totalSec % 60;
  return { h, m, s };
};

const ReviewCountdown = ({ target }: { target: Date | null }) => {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), COUNTDOWN_TICK_MS);
    return () => clearInterval(id);
  }, [target]);

  const diffMs = target === null ? 0 : target.getTime() - now;

  if (diffMs <= 0) {
    return (
      <div className="countdown-bar available">
        <div className="countdown-dot available" />
        <span className="countdown-label">Next review</span>
        <span className="countdown-value available">Available now</span>
      </div>
    );
  }

  const { h, m, s } = formatCountdown(diffMs);

  return (
    <div className="countdown-bar waiting">
      <div className="countdown-dot waiting" />
      <span className="countdown-label">Next review available in</span>
      <span className="countdown-value">
        {h}h {String(m).padStart(2, '0')}m {String(s).padStart(2, '0')}s
      </span>
    </div>
  );
};

export default ReviewCountdown;
