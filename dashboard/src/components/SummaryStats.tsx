import { DEFAULT_DURATION } from '../../../src/utils/durations.js';
import type { DashboardStateResponse } from '../api.js';
import { fetchDashboardState } from '../api.js';

import QueueOrder from './QueueOrder.js';
import ReviewCountdown from './ReviewCountdown.js';

import { useCallback, useEffect, useRef, useState } from 'react';

const POLL_INTERVAL_MS = 30_000;

const SummaryStats = () => {
  const [data, setData] = useState<DashboardStateResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [duration, setDuration] = useState(DEFAULT_DURATION);

  const mountedRef = useRef(false);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const fetchData = useCallback(() => {
    fetchDashboardState(duration)
      .then((res) => {
        if (!mountedRef.current) return;
        setError(null);
        setData(res);
      })
      .catch((err: Error) => {
        if (!mountedRef.current) return;
        // Preserve last-known data — only set error on transient failures
        setError(err.message);
      });
  }, [duration]);

  useEffect(() => {
    fetchData();
    const intervalId = setInterval(fetchData, POLL_INTERVAL_MS);
    return () => clearInterval(intervalId);
  }, [fetchData]);

  if (error && !data) return <div className="error">Failed to load summary: {error}</div>;
  if (!data) return <div className="loading">Loading summary…</div>;

  return (
    <section>
      <ReviewCountdown target={data.nextReviewAvailableAt ? new Date(data.nextReviewAvailableAt) : null} />
      <h2>Summary</h2>

      <div className="section-card">
        <QueueOrder items={data.pendingItems} error={null} onMoveComplete={fetchData} headingLevel="h3" pendingCount={data.pendingItems.length} />
      </div>

      <div className="section-card">
        <h3>
          Events —{' '}
          <select className="duration-select" value={duration} onChange={(e) => setDuration(e.target.value)} aria-label="Events time range">
            <option value={DEFAULT_DURATION}>Last 24h</option>
            <option value="2d">Last 2d</option>
            <option value="3d">Last 3d</option>
            <option value="5d">Last 5d</option>
            <option value="1w">Last 1w</option>
          </select>
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
