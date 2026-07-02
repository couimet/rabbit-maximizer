import type { EventCounts, QueueCounts, SummaryResponse } from '../api.js';
import { fetchSummary } from '../api.js';

import QueueOrder from './QueueOrder.js';

import { useEffect, useState } from 'react';

const SummaryStats = () => {
  const [data, setData] = useState<SummaryResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchSummary()
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, []);

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

      <h3>Events (last 24h)</h3>
      <div className="summary-grid">
        {Object.entries(data.eventCounts24h as EventCounts).map(([type, count]) => (
          <div key={type} className="summary-card">
            <span className="stat-label">{type}</span>
            <span className="stat-value">{count}</span>
          </div>
        ))}
      </div>

      <QueueOrder />
    </section>
  );
};

export default SummaryStats;
