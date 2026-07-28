import type { QueueItemResponse } from '../../../src/types/index.js';
import { type Duration, formatRelativeTime, resolveDurationSince } from '../../../src/utils/index.js';
import { safeDeriveActivityStatus } from '../activityState.js';
import { fetchTriggered, markResolved } from '../api.js';
import { useErrorContext } from '../context/index.js';
import { prUrl } from '../githubUrl.js';

import { DurationSelect, formatElapsed, STATE_CLASS, STATE_LABEL } from './index.js';

import { useCallback, useEffect, useRef, useState } from 'react';

const PAGE_SIZE = 50;
const POLL_INTERVAL_MS = 30_000;
const RELATIVE_TIME_REFRESH_MS = 60_000;

const TRIGGERED_DEFAULT_DURATION = '2d';

/* c8 ignore next 2 — both branches tested but V8 coverage cannot track arrow-function ternaries in React render paths */
const formatRetriggeredTime = (item: QueueItemResponse): string => (item.retriggered_at != null ? formatRelativeTime(item.retriggered_at) : '—');

/* c8 ignore next 2 — both branches tested but V8 coverage cannot track nested ternaries in React render paths */
const formatApprovalBadge = (subState: string | undefined): string =>
  subState === 'review_approved' ? ' ✓' : subState === 'review_changes_suggested' ? ' Δ' : '';

const RecentlyTriggered = ({ schedulerStale, lastSchedulerTickAt }: { schedulerStale: boolean; lastSchedulerTickAt: string | null }) => {
  const [items, setItems] = useState<QueueItemResponse[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const { reportError, dismissError } = useErrorContext();
  const [duration, setDuration] = useState<Duration>(TRIGGERED_DEFAULT_DURATION);
  const [includeResolved, setIncludeResolved] = useState(false);
  const [, setTick] = useState(0);

  const mountedRef = useRef(false);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const lastUpdatedRef = useRef<Date | null>(null);
  const requestIdRef = useRef(0);

  const fetchData = useCallback(
    (pageNum: number, append: boolean) => {
      requestIdRef.current += 1;
      const requestId = requestIdRef.current;
      setLoading(true);
      fetchTriggered(resolveDurationSince(duration), pageNum, PAGE_SIZE, includeResolved)
        .then((res) => {
          /* c8 ignore next 2 — cleanup guards: unmount and stale request detection */
          if (!mountedRef.current) return;
          if (requestId !== requestIdRef.current) return;
          lastUpdatedRef.current = new Date();
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
          reportError('recently-triggered', 'Recently triggered', err.message);
          setLoading(false);
        });
    },
    [duration, includeResolved, reportError, dismissError],
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

  const handleMarkResolved = (uuid: string) => {
    setItems((prev) => prev.filter((i) => i.uuid !== uuid));
    /* c8 ignore next — safety fallback: total is always set when items are displayed */
    setTotal((t) => (t !== null ? t - 1 : null));
    markResolved(uuid).catch((err: Error) => {
      reportError('recently-triggered-mark-resolved', 'Recently triggered', err.message);
      fetchData(1, false);
    });
  };

  const hasMore = total !== null && items.length < total;

  const renderStatusPill = (item: QueueItemResponse) => {
    const { state, linkUrl, subState } = safeDeriveActivityStatus(item);
    const label = STATE_LABEL[state];
    const className = `status-pill ${STATE_CLASS[state]}`;
    const badge = formatApprovalBadge(subState);
    if (linkUrl) {
      return (
        <a href={linkUrl} className={className} target="_blank" rel="noopener noreferrer">
          {label}
          {badge}
        </a>
      );
    }
    return (
      <span className={className}>
        {label}
        {badge}
      </span>
    );
  };

  return (
    <div className="section-card">
      <h3>
        Recently Triggered — <DurationSelect value={duration} onChange={setDuration} aria-label="Triggered time range" />
      </h3>

      <label className="show-reviewed-toggle">
        <input type="checkbox" checked={includeResolved} onChange={(e) => setIncludeResolved(e.target.checked)} /> Show resolved
      </label>

      {loading && items.length === 0 ? (
        <div className="loading">Loading triggered items…</div>
      ) : items.length === 0 ? (
        <p>No triggered items in this time window.</p>
      ) : (
        <>
          {schedulerStale && (
            <div className="scheduler-stale-banner">
              <div>Scheduler may be down — no heartbeat for {formatElapsed(lastSchedulerTickAt) ?? 'unknown'}</div>
              {lastUpdatedRef.current !== null && <div>Data refreshed {formatRelativeTime(lastUpdatedRef.current.toISOString())}</div>}
            </div>
          )}
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
                <tr key={item.uuid} className={item.status === 'resolved' ? 'row-status-reviewed' : ''}>
                  <td>
                    <a href={item.retrigger_comment_url ?? prUrl(item.repo_full_name, item.pr_number)} target="_blank" rel="noreferrer">
                      {item.pr_title} (#{item.pr_number})
                    </a>{' '}
                    by {item.author_login}
                  </td>
                  <td>{formatRetriggeredTime(item)}</td>
                  <td>{renderStatusPill(item)}</td>
                  <td>
                    {item.status !== 'resolved' && (
                      <button
                        className="mark-reviewed-button"
                        onClick={() => handleMarkResolved(item.uuid)}
                        title={schedulerStale ? 'Unavailable while scheduler is down' : 'Mark as resolved'}
                        disabled={schedulerStale}
                      >
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
