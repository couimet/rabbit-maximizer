import { DEFAULT_DURATION } from '../../../src/utils/durations.js';
import type { EventCounts, QueueCounts, SummaryResponse } from '../api.js';
import { fetchNextReviewAvailable, fetchSummary } from '../api.js';

import QueueOrder from './QueueOrder.js';
import ReviewCountdown from './ReviewCountdown.js';

import { useEffect, useState } from 'react';

const POLL_INTERVAL_MS = 30_000;

const SummaryStats = () => {
  const [data, setData] = useState<SummaryResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [duration, setDuration] = useState(DEFAULT_DURATION);
  const [nextReview, setNextReview] = useState<Date | null>(null);

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

  useEffect(() => {
    let cancelled = false;

    const doFetch = () => {
      fetchNextReviewAvailable()
        .then((data) => {
          if (!cancelled) {
            setNextReview(data.next_review_available_at ? new Date(data.next_review_available_at) : null);
          }
        })
        .catch(() => {
          // Preserve last known nextReview on transient fetch failures
        });
    };

    doFetch();
    const intervalId = setInterval(doFetch, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, []);

  if (error) return <div className="error">Failed to load summary: {error}</div>;
  if (!data) return <div className="loading">Loading summary…</div>;

  return (
    <section>
      <ReviewCountdown target={nextReview} />
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
