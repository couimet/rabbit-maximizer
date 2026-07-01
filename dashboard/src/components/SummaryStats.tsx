import type { EventCounts, QueueCounts, QueueItem, SummaryResponse } from '../api.js';
import { fetchSummary } from '../api.js';
import { formatDate } from '../formatDate.js';
import { prUrl, repoUrl } from '../githubUrl.js';
import { useTimezone } from '../timezone.js';

import { useEffect, useState } from 'react';

const SummaryStats = () => {
  const [data, setData] = useState<SummaryResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { timezone } = useTimezone();

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

      <h3>Oldest Pending</h3>
      <OldestPending item={data.oldestPending} timezone={timezone} />
    </section>
  );
};

const OldestPending = ({ item, timezone }: { item: QueueItem | null; timezone: string }) => {
  const suffix = timezone === 'UTC' ? ' (UTC)' : '';
  if (!item) return <p>No pending items.</p>;

  return (
    <table className="data-table">
      <thead>
        <tr>
          <th>Repo</th>
          <th>PR</th>
          <th>Scheduled For{suffix}</th>
          <th>Attempts</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>
            <a href={repoUrl(item.repo_full_name)} target="_blank" rel="noopener noreferrer">
              {item.repo_full_name}
            </a>
          </td>
          <td>
            <a href={prUrl(item.repo_full_name, item.pr_number)} target="_blank" rel="noopener noreferrer">
              #{item.pr_number}
            </a>
          </td>
          <td>{formatDate(item.scheduled_for, timezone)}</td>
          <td>{item.attempts}</td>
        </tr>
      </tbody>
    </table>
  );
};

export default SummaryStats;
