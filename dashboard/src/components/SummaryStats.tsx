import type { DashboardStateResponse, PublicConfigResponse } from '../../../src/types/index.js';
import { DEFAULT_DURATION, type Duration } from '../../../src/utils/index.js';
import { fetchConfig, fetchDashboardState, setPaused } from '../api.js';
import { useErrorContext } from '../context/index.js';

import { ActivityList, DurationSelect, formatElapsed, QueueOrder, ReviewCountdown, usePauseNotification } from './index.js';

import './SummaryStats.css';
import { useCallback, useEffect, useRef, useState } from 'react';

const POLL_INTERVAL_MS = 30_000;
const DEFAULT_STALE_THRESHOLD_MS = 40_000;

const SummaryStats = () => {
  const [data, setData] = useState<DashboardStateResponse | null>(null);
  const [duration, setDuration] = useState<Duration>(DEFAULT_DURATION);
  const { reportError, dismissError } = useErrorContext();
  const [toggling, setToggling] = useState(false);
  const [staleThresholdMs, setStaleThresholdMs] = useState(DEFAULT_STALE_THRESHOLD_MS);
  const [localStale, setLocalStale] = useState(false);

  const mountedRef = useRef(false);
  const lastKnownTickRef = useRef<string | null>(null);
  const lastKnownSchedulerStaleRef = useRef(false);
  const lastUpdatedRef = useRef<Date | null>(null);
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
        lastUpdatedRef.current = new Date();
        setLocalStale(false);
        lastKnownSchedulerStaleRef.current = res.schedulerStale;
        setData(res);
      })
      .catch((err: Error) => {
        if (!mountedRef.current) return;
        if (requestId !== requestIdRef.current) return;

        const lastTick = lastKnownTickRef.current;
        const isStale =
          lastKnownSchedulerStaleRef.current ||
          (() => {
            if (!lastTick) return true;
            return Date.now() - new Date(lastTick).getTime() > staleThresholdMs;
          })();

        setLocalStale(isStale);

        reportError('summary-stats', 'Summary', isStale ? `${err.message} — data may not reflect current state` : err.message);
      });
    /* c8 ignore next 1 — eslint: data is not a dep to avoid recreating the callback on every data change; lastKnownTickRef.current provides the current tick state via ref */
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
        reportError('summary-stats', 'Summary', err.message);
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
          <button className="retry-now-button" onClick={fetchData}>
            Retry now
          </button>
        </div>
      )}
      <ReviewCountdown
        target={data.nextReviewAvailableAt ? new Date(data.nextReviewAvailableAt) : null}
        paused={data.paused}
        onTogglePaused={handleTogglePaused}
        toggling={toggling}
        schedulerStale={data.schedulerStale || localStale}
        lastSchedulerTickAt={data.lastSchedulerTickAt ?? lastKnownTickRef.current}
      />
      <h2>Summary</h2>

      <div className="section-card">
        <QueueOrder
          items={data.pendingItems}
          onMoveComplete={fetchData}
          headingLevel="h3"
          paused={data.paused}
          schedulerStale={data.schedulerStale || localStale}
          lastUpdatedAt={lastUpdatedRef.current}
          lastSchedulerTickAt={data.lastSchedulerTickAt ?? lastKnownTickRef.current}
        />
      </div>

      <ActivityList schedulerStale={data.schedulerStale || localStale} lastSchedulerTickAt={data.lastSchedulerTickAt ?? lastKnownTickRef.current} />

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
