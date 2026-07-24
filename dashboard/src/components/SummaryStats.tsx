import type { DashboardStateResponse, PublicConfigResponse } from '../../../src/types/index.js';
import { DEFAULT_DURATION, type Duration, MS_PER_SECOND, SECONDS_PER_HOUR, SECONDS_PER_MINUTE } from '../../../src/utils/index.js';
import { fetchConfig, fetchDashboardState, setPaused } from '../api.js';
import { useErrorContext } from '../context/index.js';

import { DurationSelect, QueueOrder, RecentlyTriggered, ReviewCountdown, usePauseNotification } from './index.js';

import './SummaryStats.css';
import { useCallback, useEffect, useRef, useState } from 'react';

const POLL_INTERVAL_MS = 30_000;
const DEFAULT_STALE_THRESHOLD_MS = 40_000;

const formatElapsed = (lastSchedulerTickAt: string | null): string | null => {
  if (!lastSchedulerTickAt) return null;
  const elapsedMs = Date.now() - new Date(lastSchedulerTickAt).getTime();
  const elapsedSec = Math.floor(elapsedMs / MS_PER_SECOND);
  if (elapsedSec < SECONDS_PER_MINUTE) return `${elapsedSec} second${elapsedSec === 1 ? '' : 's'}`;
  if (elapsedSec < SECONDS_PER_HOUR) {
    const minutes = Math.floor(elapsedSec / SECONDS_PER_MINUTE);
    return `${minutes} minute${minutes === 1 ? '' : 's'}`;
  }
  const hours = Math.floor(elapsedSec / SECONDS_PER_HOUR);
  return `${hours} hour${hours === 1 ? '' : 's'}`;
};

const SummaryStats = () => {
  const [data, setData] = useState<DashboardStateResponse | null>(null);
  const [duration, setDuration] = useState<Duration>(DEFAULT_DURATION);
  const { reportError, dismissError } = useErrorContext();
  const [toggling, setToggling] = useState(false);
  const [staleThresholdMs, setStaleThresholdMs] = useState(DEFAULT_STALE_THRESHOLD_MS);
  const [localStale, setLocalStale] = useState(false);

  const mountedRef = useRef(false);
  const lastKnownTickRef = useRef<string | null>(null);
  const requestIdRef = useRef(0);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    fetchConfig()
      .then((cfg: PublicConfigResponse) => {
        if (!mountedRef.current) return;
        setStaleThresholdMs(cfg.schedulerStaleThresholdMs);
      })
      .catch(() => {
        // fall back to the default staleThresholdMs already set in state
      });
  }, []);

  const fetchData = useCallback(() => {
    requestIdRef.current += 1;
    const requestId = requestIdRef.current;
    fetchDashboardState(duration)
      .then((res) => {
        if (!mountedRef.current) return;
        if (requestId !== requestIdRef.current) return;
        dismissError('summary-stats');
        if (res.lastSchedulerTickAt) {
          lastKnownTickRef.current = res.lastSchedulerTickAt;
        }
        setLocalStale(false);
        setData(res);
      })
      .catch((err: Error) => {
        if (!mountedRef.current) return;
        if (requestId !== requestIdRef.current) return;
        reportError('summary-stats', err.message);
        const lastTick = lastKnownTickRef.current;
        if (!lastTick) {
          setLocalStale(true);
        } else {
          setLocalStale(Date.now() - new Date(lastTick).getTime() > staleThresholdMs);
        }
      });
  }, [duration, dismissError, reportError, staleThresholdMs]);

  useEffect(() => {
    fetchData();
    const intervalId = setInterval(fetchData, POLL_INTERVAL_MS);
    return () => clearInterval(intervalId);
  }, [fetchData]);

  const handleTogglePaused = () => {
    /* c8 ignore next 2 — unreachable: button only renders when data is non-null */
    if (!data) return;
    setToggling(true);
    const next = !data.paused;
    setPaused(next)
      .then(() => {
        if (!mountedRef.current) return;
        fetchData();
        setToggling(false);
      })
      .catch((err: Error) => {
        if (!mountedRef.current) return;
        reportError('summary-stats', err.message);
        setToggling(false);
      });
  };

  usePauseNotification({ paused: data ? data.paused : false });

  if (!data) return <div className="loading">Loading summary…</div>;

  return (
    <section>
      {(data.schedulerStale || localStale) && (
        <div className="scheduler-stale-banner">
          Scheduler may be down —{' '}
          {(() => {
            const tick = data.lastSchedulerTickAt ?? lastKnownTickRef.current;
            return tick ? `no heartbeat for ${formatElapsed(tick)}` : 'no heartbeat yet';
          })()}
        </div>
      )}
      <ReviewCountdown
        target={data.nextReviewAvailableAt ? new Date(data.nextReviewAvailableAt) : null}
        paused={data.paused}
        onTogglePaused={handleTogglePaused}
        toggling={toggling}
      />
      <h2>Summary</h2>

      <div className="section-card">
        <QueueOrder
          items={data.pendingItems}
          error={null}
          onMoveComplete={fetchData}
          headingLevel="h3"
          pendingCount={data.pendingItems.length}
          paused={data.paused}
        />
      </div>

      <RecentlyTriggered />

      <div className="section-card">
        <h3>
          Events — <DurationSelect value={duration} onChange={setDuration} aria-label="Events time range" />
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
