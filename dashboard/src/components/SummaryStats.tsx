import { DEFAULT_DURATION } from '../../../src/utils/durations.js';
import type { EventCounts, QueueCounts, SummaryResponse } from '../api.js';
import { fetchSummary } from '../api.js';

import QueueOrder from './QueueOrder.js';

import { useEffect, useState } from 'react';

const SummaryStats = () => {
  const [data, setData] = useState<SummaryResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [duration, setDuration] = useState(DEFAULT_DURATION);

  useEffect(() => {
    let cancelled = false;
    fetchSummary(duration)
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, [duration]);

  if (error) return <div className="error">Failed to load summary: {error}</div>;
  if (!data) return <div className="loading">Loading summary…</div>;

  return (
    <section>
      <h2>Summary</h2>

      <h3>Queue Counts</h3>
      <div className="summary-grid">
        {Object.entries(data.queueCounts as QueueCounts).map(([status, count]) => (
          <div key={status} className={`summary-card status-${status}`}>
            <span className="stat-label">{status}</span>
            <span className="stat-value">{count}</span>
          </div>
        ))}
      </div>

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
        {Object.entries(data.eventCounts as EventCounts).map(([type, count]) => (
          <div key={type} className="summary-card">
            <span className="stat-label">{type}</span>
            <span className="stat-value">{count}</span>
          </div>
        ))}
      </div>

      <QueueOrder headingLevel="h3" />
    </section>
  );
};

export default SummaryStats;
