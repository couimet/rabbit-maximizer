import { formatRelativeTime } from '../../../src/utils/formatRelativeTime.js';
import { type Duration, resolveDurationSince } from '../../../src/utils/resolveDurationSince.js';
import type { QueueItem } from '../api.js';
import { fetchTriggered, markCompleted } from '../api.js';
import { prUrl, repoUrl } from '../githubUrl.js';

import DurationSelect from './DurationSelect.js';

import { useCallback, useEffect, useRef, useState } from 'react';

const PAGE_SIZE = 50;
const POLL_INTERVAL_MS = 30_000;
const RELATIVE_TIME_REFRESH_MS = 60_000;

const TRIGGERED_DEFAULT_DURATION = '2d';

const RecentlyTriggered = () => {
  const [items, setItems] = useState<QueueItem[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [duration, setDuration] = useState<Duration>(TRIGGERED_DEFAULT_DURATION);
  const [includeCompleted, setIncludeCompleted] = useState(false);
  const [, setTick] = useState(0);

  const mountedRef = useRef(false);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const requestIdRef = useRef(0);

  const fetchData = useCallback(
    (pageNum: number, append: boolean) => {
      requestIdRef.current += 1;
      const requestId = requestIdRef.current;
      setLoading(true);
      fetchTriggered(resolveDurationSince(duration), pageNum, PAGE_SIZE, includeCompleted)
        .then((res) => {
          /* c8 ignore next 2 — cleanup guards: unmount and stale request detection */
          if (!mountedRef.current) return;
          if (requestId !== requestIdRef.current) return;
          setError(null);
          setTotal(res.total);
          if (append) {
            setItems((prev) => [...prev, ...res.data]);
          } else {
            setItems(res.data);
          }
          setLoading(false);
        })
        .catch((err: Error) => {
          /* c8 ignore next 2 — cleanup guards: unmount and stale request detection */
          if (!mountedRef.current) return;
          if (requestId !== requestIdRef.current) return;
          setError(err.message);
          setLoading(false);
        });
    },
    [duration, includeCompleted],
  );

  // Initial fetch and poll
  useEffect(() => {
    setPage(1);
    setItems([]);
    fetchData(1, false);
    const intervalId = setInterval(() => fetchData(1, false), POLL_INTERVAL_MS);
    return () => clearInterval(intervalId);
  }, [fetchData]);

  // Relative-time re-render tick — cosmetic DOM refresh for "2h ago" display
  useEffect(() => {
    const intervalId = setInterval(() => setTick((t) => t + 1), RELATIVE_TIME_REFRESH_MS);
    return () => clearInterval(intervalId);
  }, []);

  const handleLoadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    fetchData(nextPage, true);
  };

  const handleMarkCompleted = (uuid: string) => {
    setItems((prev) => prev.filter((i) => i.uuid !== uuid));
    /* c8 ignore next — safety fallback: total is always set when items are displayed */
    setTotal((t) => (t !== null ? t - 1 : null));
    markCompleted(uuid).catch((err: Error) => {
      setError(err.message);
      fetchData(1, false);
    });
  };

  const hasMore = total !== null && items.length < total;

  if (error && items.length === 0 && !loading) return <div className="error">Failed to load triggered items: {error}</div>;

  return (
    <div className="section-card">
      <h3>
        Recently Triggered — <DurationSelect value={duration} onChange={setDuration} aria-label="Triggered time range" />
      </h3>

      <label className="show-completed-toggle">
        <input type="checkbox" checked={includeCompleted} onChange={(e) => setIncludeCompleted(e.target.checked)} /> Show completed
      </label>

      {error && <div className="error-banner">Failed to refresh: {error}</div>}

      {loading && items.length === 0 ? (
        <div className="loading">Loading triggered items…</div>
      ) : items.length === 0 ? (
        <p>No triggered items in this time window.</p>
      ) : (
        <>
          <table className="data-table triggered-table">
            <thead>
              <tr>
                <th>Repo</th>
                <th>PR</th>
                <th>Retriggered</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.uuid} className={item.status === 'completed' ? 'row-status-completed' : ''}>
                  <td>
                    <a href={repoUrl(item.repo_full_name)} target="_blank" rel="noreferrer">
                      {item.repo_full_name}
                    </a>
                  </td>
                  <td>
                    <a href={item.retrigger_comment_url ?? prUrl(item.repo_full_name, item.pr_number)} target="_blank" rel="noreferrer">
                      #{item.pr_number}
                    </a>
                  </td>
                  <td>{item.retriggered_at ? formatRelativeTime(item.retriggered_at) : '—'}</td>
                  <td>
                    {item.status === 'completed' ? (
                      <span className="status-pill completed">Completed</span>
                    ) : (
                      <span className="status-pill retriggered">Retriggered</span>
                    )}
                  </td>
                  <td>
                    {item.status !== 'completed' && (
                      <button className="mark-completed-button" onClick={() => handleMarkCompleted(item.uuid)} title="Mark as completed">
                        ✓
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {hasMore && (
            <div className="load-more-container">
              <button className="load-more-button" onClick={handleLoadMore} disabled={loading}>
                {loading ? 'Loading…' : `Load more (${total! - items.length} remaining)`}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default RecentlyTriggered;
