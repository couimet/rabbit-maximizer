import type { QueueItemResponse } from '../../../src/types/index.js';
import { type Duration, formatRelativeTime, resolveDurationSince } from '../../../src/utils/index.js';
import { fetchTriggered, markReviewed } from '../api.js';
import { useErrorContext } from '../context/index.js';
import { prUrl, repoUrl } from '../githubUrl.js';

import { DurationSelect } from './index.js';

import { useCallback, useEffect, useRef, useState } from 'react';

const PAGE_SIZE = 50;
const POLL_INTERVAL_MS = 30_000;
const RELATIVE_TIME_REFRESH_MS = 60_000;

const TRIGGERED_DEFAULT_DURATION = '2d';

const RecentlyTriggered = () => {
  const [items, setItems] = useState<QueueItemResponse[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const { reportError, dismissError } = useErrorContext();
  const [duration, setDuration] = useState<Duration>(TRIGGERED_DEFAULT_DURATION);
  const [includeReviewed, setIncludeReviewed] = useState(false);
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
      fetchTriggered(resolveDurationSince(duration), pageNum, PAGE_SIZE, includeReviewed)
        .then((res) => {
          /* c8 ignore next 2 — cleanup guards: unmount and stale request detection */
          if (!mountedRef.current) return;
          if (requestId !== requestIdRef.current) return;
          dismissError('recently-triggered');
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
          reportError('recently-triggered', err.message);
          setLoading(false);
        });
    },
    [duration, includeReviewed, reportError, dismissError],
  );

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

  const handleMarkReviewed = (uuid: string) => {
    setItems((prev) => prev.filter((i) => i.uuid !== uuid));
    /* c8 ignore next — safety fallback: total is always set when items are displayed */
    setTotal((t) => (t !== null ? t - 1 : null));
    markReviewed(uuid).catch((err: Error) => {
      reportError('recently-triggered-mark-reviewed', err.message);
      fetchData(1, false);
    });
  };

  const hasMore = total !== null && items.length < total;

  return (
    <div className="section-card">
      <h3>
        Recently Triggered — <DurationSelect value={duration} onChange={setDuration} aria-label="Triggered time range" />
      </h3>

      <label className="show-reviewed-toggle">
        <input type="checkbox" checked={includeReviewed} onChange={(e) => setIncludeReviewed(e.target.checked)} /> Show reviewed
      </label>

      {loading && items.length === 0 ? (
        <div className="loading">Loading triggered items…</div>
      ) : items.length === 0 ? (
        <p>No triggered items in this time window.</p>
      ) : (
        <>
          <table className="data-table triggered-table">
            <thead>
              <tr>
                <th>Repo / PR</th>
                <th>Retriggered</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.uuid} className={item.status === 'reviewed' ? 'row-status-reviewed' : ''}>
                  <td>
                    <a href={repoUrl(item.repo_full_name)} target="_blank" rel="noreferrer">
                      {item.repo_full_name}
                    </a>{' '}
                    <a href={item.retrigger_comment_url ?? prUrl(item.repo_full_name, item.pr_number)} target="_blank" rel="noreferrer">
                      #{item.pr_number}
                    </a>
                    <span className="pr-title">{item.pr_title}</span>
                  </td>
                  <td>{item.retriggered_at ? formatRelativeTime(item.retriggered_at) : '—'}</td>
                  <td>
                    {item.status === 'reviewed' ? (
                      <span className="status-pill reviewed">Reviewed</span>
                    ) : (
                      <span className="status-pill retriggered">Retriggered</span>
                    )}
                  </td>
                  <td>
                    {item.status !== 'reviewed' && (
                      <button className="mark-reviewed-button" onClick={() => handleMarkReviewed(item.uuid)} title="Mark as reviewed">
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
