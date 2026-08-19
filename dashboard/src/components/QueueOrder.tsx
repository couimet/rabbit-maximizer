import type { QueueItemResponse } from '../../../src/types/index.js';
import { formatRelativeTime } from '../../../src/utils/index.js';
import { safeDeriveActivityStatus } from '../activityState.js';
import { moveQueueItems, moveToTop, retriggerNow } from '../api.js';
import { prUrl } from '../githubUrl.js';

import { ConfirmDialog, formatElapsed, STATE_CLASS, STATE_LABEL } from './index.js';

import './QueueOrder.css';
import { useEffect, useRef, useState } from 'react';

const RELATIVE_TIME_REFRESH_MS = 60_000;
const TOAST_DISMISS_MS = 8000;

const renderQueueOrderStatus = (item: QueueItemResponse) => {
  const { state, linkUrl } = safeDeriveActivityStatus(item);
  const label = STATE_LABEL[state];
  const className = `status-pill ${STATE_CLASS[state]}`;
  if (linkUrl) {
    return (
      <a href={linkUrl} className={className} target="_blank" rel="noopener noreferrer">
        {label}
      </a>
    );
  }
  return <span className={className}>{label}</span>;
};

const QueueOrder = ({
  items,
  schedulerStale,
  lastUpdatedAt,
  lastSchedulerTickAt,
  onMoveComplete,
  headingLevel,
  paused,
}: {
  items: QueueItemResponse[] | null;
  schedulerStale: boolean;
  lastUpdatedAt: Date | null;
  lastSchedulerTickAt: string | null;
  onMoveComplete: () => void;
  headingLevel: 'h2' | 'h3';
  paused: boolean;
}) => {
  const [, forceTick] = useState(0);
  const [selectedUuids, setSelectedUuids] = useState<Set<string>>(new Set());
  const [moving, setMoving] = useState(false);
  const [moveError, setMoveError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; variant: 'success' | 'error' } | null>(null);
  const [retriggeringUuid, setRetriggeringUuid] = useState<string | null>(null);
  const [movingToTopUuid, setMovingToTopUuid] = useState<string | null>(null);
  const [confirmRetriggerUuid, setConfirmRetriggerUuid] = useState<string | null>(null);

  const mountedRef = useRef(false);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), TOAST_DISMISS_MS);
    return () => clearTimeout(id);
  }, [toast]);

  useEffect(() => {
    const id = setInterval(() => forceTick((t) => t + 1), RELATIVE_TIME_REFRESH_MS);
    return () => clearInterval(id);
  }, []);

  const toggleSelect = (uuid: string) => {
    setSelectedUuids((prev) => {
      const next = new Set(prev);
      if (next.has(uuid)) next.delete(uuid);
      else next.add(uuid);
      return next;
    });
  };

  const toggleSelectAll = () => {
    /* c8 ignore next 2 — type guard: toggleSelectAll only rendered when items is non-null */
    if (!items) return;
    if (selectedUuids.size === items.length) {
      setSelectedUuids(new Set());
    } else {
      setSelectedUuids(new Set(items.map((item) => item.uuid)));
    }
  };

  const handleMove = (direction: 'up' | 'down', uuids: string[]) => {
    setMoving(true);
    setMoveError(null);
    moveQueueItems(uuids, direction)
      .then((res) => {
        if (!mountedRef.current) return;
        if (Array.isArray(res.data)) {
          setToast({ message: `Moved ${direction}`, variant: 'success' });
          onMoveComplete();
        } else {
          setMoveError('Unexpected response from server');
        }
        setSelectedUuids(new Set());
        setMoving(false);
      })
      .catch((err: Error) => {
        if (!mountedRef.current) return;
        setMoveError(err.message);
        setMoving(false);
      });
  };

  const handleMoveToTop = (uuid: string) => {
    setMovingToTopUuid(uuid);
    moveToTop(uuid)
      .then(() => {
        if (!mountedRef.current) return;
        setToast({ message: 'Moved to top', variant: 'success' });
        setMovingToTopUuid(null);
        onMoveComplete();
      })
      .catch((err: Error) => {
        if (!mountedRef.current) return;
        setToast({ message: err.message, variant: 'error' });
        setMovingToTopUuid(null);
      });
  };

  const handleRetriggerNow = (uuid: string) => {
    if (paused) {
      setConfirmRetriggerUuid(uuid);
      return;
    }
    executeRetrigger(uuid);
  };

  const executeRetrigger = (uuid: string) => {
    if (schedulerStale) return;
    setRetriggeringUuid(uuid);
    retriggerNow(uuid, paused)
      .then(() => {
        if (!mountedRef.current) return;
        setToast({ message: 'Retrigger requested', variant: 'success' });
        setRetriggeringUuid(null);
        onMoveComplete();
      })
      .catch((err: Error) => {
        if (!mountedRef.current) return;
        setToast({ message: err.message, variant: 'error' });
        setRetriggeringUuid(null);
      });
  };

  const moveSingle = (uuid: string, direction: 'up' | 'down') => handleMove(direction, [uuid]);
  const moveSelected = (direction: 'up' | 'down') => {
    /* c8 ignore next 2 — unreachable: toolbar buttons are disabled when nothing is selected */
    if (selectedUuids.size === 0) return;
    handleMove(direction, Array.from(selectedUuids));
  };

  const Heading = headingLevel;

  const staleBanner = schedulerStale ? (
    <div className="section-stale-banner">
      <div>Scheduler may be down — no heartbeat for {formatElapsed(lastSchedulerTickAt) ?? 'unknown'}</div>
      {lastUpdatedAt !== null && <div>Data refreshed {formatRelativeTime(lastUpdatedAt.toISOString())}</div>}
    </div>
  ) : null;

  if (!items)
    return (
      <>
        {staleBanner}
        <div className="loading">Loading queue order…</div>
      </>
    );

  const hasSelection = selectedUuids.size > 0;
  const allSelected = items.length > 0 && selectedUuids.size === items.length;

  return (
    <section>
      <Heading>
        Queue Order — {items.length} {items.length === 1 ? 'item' : 'items'}
      </Heading>
      {moveError && <div className="error">Move failed: {moveError}</div>}
      {staleBanner}
      {items.length === 0 ? (
        <p>No items in queue.</p>
      ) : (
        <>
          <div className="queue-order-toolbar-wrapper">
            <div className="queue-order-toolbar">
              <button
                disabled={!hasSelection || moving || retriggeringUuid !== null || movingToTopUuid !== null || schedulerStale}
                onClick={() => moveSelected('up')}
                title={schedulerStale ? 'Unavailable while scheduler is down' : undefined}
              >
                Move Up
              </button>
              <button
                disabled={!hasSelection || moving || retriggeringUuid !== null || movingToTopUuid !== null || schedulerStale}
                onClick={() => moveSelected('down')}
                title={schedulerStale ? 'Unavailable while scheduler is down' : undefined}
              >
                Move Down
              </button>
            </div>
            {toast && <div className={'toast toast-' + toast.variant}>{toast.message}</div>}
          </div>
          <table className="data-table queue-order-table">
            <thead>
              <tr>
                <th className="col-select">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleSelectAll}
                    disabled={moving || retriggeringUuid !== null || movingToTopUuid !== null || schedulerStale}
                    aria-label="Select all items"
                    title={schedulerStale ? 'Unavailable while scheduler is down' : undefined}
                  />
                </th>
                <th className="col-position">#</th>
                <th>Repo / PR</th>
                <th>Status</th>
                <th className="col-actions"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, index) => {
                const isSelected = selectedUuids.has(item.uuid);
                const rowClass = isSelected ? 'row-selected' : '';
                return (
                  <tr key={item.uuid} className={rowClass}>
                    <td className="col-select">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelect(item.uuid)}
                        disabled={moving || retriggeringUuid !== null || movingToTopUuid !== null || schedulerStale}
                        aria-label={`Select ${item.repo_full_name} #${item.pr_number}`}
                        title={schedulerStale ? 'Unavailable while scheduler is down' : undefined}
                      />
                    </td>
                    <td className="col-position">{index + 1}</td>
                    <td>
                      <a href={prUrl(item.repo_full_name, item.pr_number)} target="_blank" rel="noopener noreferrer">
                        {item.pr_title} (#{item.pr_number})
                      </a>{' '}
                      by {item.author_login}
                    </td>
                    <td>{index === 0 ? renderQueueOrderStatus(item) : <span className="queue-order-carrots">{'🥕'.repeat(index)}</span>}</td>
                    <td className="col-actions">
                      <button
                        className="btn-retrigger"
                        onClick={() => handleRetriggerNow(item.uuid)}
                        disabled={moving || retriggeringUuid !== null || movingToTopUuid !== null || schedulerStale}
                        aria-label={'Retrigger now for ' + item.repo_full_name + ' #' + item.pr_number}
                        title={schedulerStale ? 'Unavailable while scheduler is down' : 'Retrigger now'}
                      >
                        ⚡
                      </button>
                      <button
                        className="btn-arrow"
                        onClick={() => handleMoveToTop(item.uuid)}
                        disabled={moving || retriggeringUuid !== null || movingToTopUuid !== null || schedulerStale}
                        aria-label="Move to top"
                        title={schedulerStale ? 'Unavailable while scheduler is down' : undefined}
                      >
                        ⇈
                      </button>
                      <button
                        className="btn-arrow"
                        onClick={() => moveSingle(item.uuid, 'up')}
                        disabled={moving || retriggeringUuid !== null || movingToTopUuid !== null || schedulerStale}
                        aria-label="Move up"
                        title={schedulerStale ? 'Unavailable while scheduler is down' : undefined}
                      >
                        ↑
                      </button>
                      <button
                        className="btn-arrow"
                        onClick={() => moveSingle(item.uuid, 'down')}
                        disabled={moving || retriggeringUuid !== null || movingToTopUuid !== null || schedulerStale}
                        aria-label="Move down"
                        title={schedulerStale ? 'Unavailable while scheduler is down' : undefined}
                      >
                        ↓
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </>
      )}
      {confirmRetriggerUuid !== null && (
        <ConfirmDialog
          message="The scheduler is currently paused. Retrigger anyway?"
          confirmLabel="Retrigger anyway"
          onConfirm={() => {
            executeRetrigger(confirmRetriggerUuid);
            setConfirmRetriggerUuid(null);
          }}
          onCancel={() => setConfirmRetriggerUuid(null)}
        />
      )}
    </section>
  );
};

export default QueueOrder;
