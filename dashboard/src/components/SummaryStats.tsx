import { DEFAULT_DURATION, type Duration } from '../../../src/utils/resolveDurationSince.js';
import type { DashboardStateResponse } from '../api.js';
import { fetchDashboardState, setPaused } from '../api.js';

import DurationSelect from './DurationSelect.js';
import QueueOrder from './QueueOrder.js';
import RecentlyTriggered from './RecentlyTriggered.js';
import ReviewCountdown from './ReviewCountdown.js';

import { useCallback, useEffect, useRef, useState } from 'react';

const POLL_INTERVAL_MS = 30_000;

const SummaryStats = () => {
  const [data, setData] = useState<DashboardStateResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [duration, setDuration] = useState<Duration>(DEFAULT_DURATION);
  const [toggling, setToggling] = useState(false);

  const mountedRef = useRef(false);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const requestIdRef = useRef(0);

  const fetchData = useCallback(() => {
    requestIdRef.current += 1;
    const requestId = requestIdRef.current;
    fetchDashboardState(duration)
      .then((res) => {
        if (!mountedRef.current) return;
        if (requestId !== requestIdRef.current) return;
        setError(null);
        setData(res);
      })
      .catch((err: Error) => {
        if (!mountedRef.current) return;
        if (requestId !== requestIdRef.current) return;
        setError(err.message);
      });
  }, [duration]);

  useEffect(() => {
    fetchData();
    const intervalId = setInterval(fetchData, POLL_INTERVAL_MS);
    return () => clearInterval(intervalId);
  }, [fetchData]);

  const handleTogglePaused = () => {
    /* c8 ignore next 2 — unreachable: button only renders when data is non-null */
    if (!data) return;
    setToggling(true);
    const next = !data.paused;
    setPaused(next)
      .then(() => {
        if (!mountedRef.current) return;
        fetchData();
        setToggling(false);
      })
      .catch((err: Error) => {
        if (!mountedRef.current) return;
        setError(err.message);
        setToggling(false);
      });
  };

  if (error && !data) return <div className="error">Failed to load summary: {error}</div>;
  if (!data) return <div className="loading">Loading summary…</div>;

  return (
    <section>
      {error && <div className="error-banner">Failed to refresh: {error}</div>}
      <ReviewCountdown
        target={data.nextReviewAvailableAt ? new Date(data.nextReviewAvailableAt) : null}
        paused={data.paused}
        onTogglePaused={handleTogglePaused}
        toggling={toggling}
      />
      <h2>Summary</h2>

      <div className="section-card">
        <QueueOrder
          items={data.pendingItems}
          error={null}
          onMoveComplete={fetchData}
          headingLevel="h3"
          pendingCount={data.pendingItems.length}
          paused={data.paused}
        />
      </div>

      <RecentlyTriggered />

      <div className="section-card">
        <h3>
          Events — <DurationSelect value={duration} onChange={setDuration} aria-label="Events time range" />
        </h3>
        <div className="summary-grid">
          {Object.entries(data.eventCounts).map(([type, count]) => (
            <div key={type} className="summary-card">
              <span className="stat-label">{type}</span>
              <span className="stat-value">{count}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default SummaryStats;
