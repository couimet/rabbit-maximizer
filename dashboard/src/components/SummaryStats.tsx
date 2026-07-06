import { DEFAULT_DURATION } from '../../../src/utils/durations.js';
import type { EventCounts, QueueItem, SummaryResponse } from '../api.js';
import { fetchNextReviewAvailable, fetchQueueOrder, fetchSummary } from '../api.js';

import QueueOrder from './QueueOrder.js';
import ReviewCountdown from './ReviewCountdown.js';

import { useEffect, useState } from 'react';

const POLL_INTERVAL_MS = 30_000;

const SummaryStats = () => {
  const [data, setData] = useState<SummaryResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [duration, setDuration] = useState(DEFAULT_DURATION);
  const [nextReview, setNextReview] = useState<Date | null>(null);
  const [queueItems, setQueueItems] = useState<QueueItem[] | null>(null);
  const [queueError, setQueueError] = useState<string | null>(null);

  const fetchQueue = () => {
    fetchQueueOrder()
      .then((res) => setQueueItems(res.data))
      .catch((err: Error) => setQueueError(err.message));
  };

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
    fetchQueue();
  }, []);

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

      <div className="section-card">
        <QueueOrder items={queueItems} error={queueError} onMoveComplete={fetchQueue} headingLevel="h3" pendingCount={queueItems?.length} />
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
          {Object.entries(data.eventCounts as EventCounts).map(([type, count]) => (
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
