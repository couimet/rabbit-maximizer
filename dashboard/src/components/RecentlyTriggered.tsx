import { Resolution } from '../../../src/domain.js';
import type { QueueItemResponse } from '../../../src/types/index.js';
import { type Duration, formatRelativeTime, resolveDurationSince } from '../../../src/utils/index.js';
import { fetchTriggered, markResolved } from '../api.js';
import { useErrorContext } from '../context/index.js';
import { prUrl, repoUrl } from '../githubUrl.js';

import { DurationSelect } from './index.js';

import { useCallback, useEffect, useRef, useState } from 'react';

const PAGE_SIZE = 50;
const POLL_INTERVAL_MS = 30_000;
const RELATIVE_TIME_REFRESH_MS = 60_000;

const TRIGGERED_DEFAULT_DURATION = '2d';

const RESOLUTION_META: Record<Resolution, { label: string; className: string }> = {
  [Resolution.ReviewCompleted]: { label: 'Reviewed', className: 'reviewed' },
  [Resolution.PrMerged]: { label: 'Merged', className: 'merged' },
  [Resolution.PrClosedWithoutMerge]: { label: 'Closed', className: 'closed' },
  [Resolution.Failed]: { label: 'Failed', className: 'failed' },
  [Resolution.Skipped]: { label: 'Skipped', className: 'skipped' },
};

/** Returns the display label for a resolution value. Falls back to the raw resolution string for unknown values. */
const resolutionLabel = (resolution: string): string => RESOLUTION_META[resolution as Resolution]?.label ?? resolution;

/** Returns the CSS class name for a resolution pill. Falls back to 'reviewed' for unknown values. */
const resolutionPillClass = (resolution: string): string => RESOLUTION_META[resolution as Resolution]?.className ?? 'reviewed';

const RecentlyTriggered = () => {
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
      reportError('recently-triggered-mark-resolved', err.message);
      fetchData(1, false);
    });
  };

  const hasMore = total !== null && items.length < total;

  const renderStatusPill = (item: QueueItemResponse) => {
    if (item.status === 'resolved') {
      const resolution = item.resolution ?? 'review_completed';
      return <span className={`status-pill ${resolutionPillClass(resolution)}`}>{resolutionLabel(resolution)}</span>;
    }
    return <span className="status-pill retriggered">Retriggered</span>;
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
                    <a href={repoUrl(item.repo_full_name)} target="_blank" rel="noreferrer">
                      {item.repo_full_name}
                    </a>{' '}
                    <a href={item.retrigger_comment_url ?? prUrl(item.repo_full_name, item.pr_number)} target="_blank" rel="noreferrer">
                      #{item.pr_number}
                    </a>
                    <span className="pr-title">{item.pr_title}</span>
                  </td>
                  <td>{item.retriggered_at ? formatRelativeTime(item.retriggered_at) : '—'}</td>
                  <td>{renderStatusPill(item)}</td>
                  <td>
                    {item.status !== 'resolved' && (
                      <button className="mark-reviewed-button" onClick={() => handleMarkResolved(item.uuid)} title="Mark as resolved">
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
