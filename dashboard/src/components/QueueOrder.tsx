import { formatRelativeFuture } from '../../../src/utils/formatRelativeFuture.js';
import type { QueueItem } from '../api.js';
import { moveQueueItems, retriggerNow } from '../api.js';
import { prUrl, repoUrl } from '../githubUrl.js';

import { useEffect, useRef, useState } from 'react';

const RELATIVE_TIME_REFRESH_MS = 60_000;
const TOAST_DISMISS_MS = 5000;

const QueueOrder = ({
  items,
  error,
  onMoveComplete,
  headingLevel,
  pendingCount,
  paused,
}: {
  items: QueueItem[] | null;
  error: string | null;
  onMoveComplete: () => void;
  headingLevel: 'h2' | 'h3';
  pendingCount: number | null;
  paused: boolean;
}) => {
  const [, forceTick] = useState(0);
  const [selectedUuids, setSelectedUuids] = useState<Set<string>>(new Set());
  const [moving, setMoving] = useState(false);
  const [moveError, setMoveError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; variant: 'success' | 'error' } | null>(null);
  const [retriggeringUuid, setRetriggeringUuid] = useState<string | null>(null);

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

  const handleRetriggerNow = (uuid: string) => {
    setRetriggeringUuid(uuid);
    retriggerNow(uuid)
      .then((res) => {
        if (!mountedRef.current) return;
        setToast({ message: 'Retrigger requested — scheduler will pick it up within ' + res.schedulerTickIntervalSec + ' seconds', variant: 'success' });
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

  if (error) return <div className="error">Failed to load queue order: {error}</div>;
  if (!items) return <div className="loading">Loading queue order…</div>;

  const hasSelection = selectedUuids.size > 0;
  const allSelected = items.length > 0 && selectedUuids.size === items.length;

  return (
    <section>
      <Heading>Queue Order{pendingCount !== null ? ` — ${pendingCount} pending item(s)` : ''}</Heading>
      {moveError && <div className="error">Move failed: {moveError}</div>}
      {toast && <div className={'toast toast-' + toast.variant}>{toast.message}</div>}
      {items.length === 0 ? (
        <p>No pending items.</p>
      ) : (
        <>
          <div className="queue-order-toolbar">
            <button disabled={!hasSelection || moving || retriggeringUuid !== null} onClick={() => moveSelected('up')}>
              Move Up
            </button>
            <button disabled={!hasSelection || moving || retriggeringUuid !== null} onClick={() => moveSelected('down')}>
              Move Down
            </button>
          </div>
          <table className="data-table queue-order-table">
            <thead>
              <tr>
                <th className="col-select">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleSelectAll}
                    disabled={moving || retriggeringUuid !== null}
                    aria-label="Select all pending items"
                  />
                </th>
                <th className="col-position">#</th>
                <th>Repo / PR</th>
                <th>Not Before</th>
                <th className="col-actions"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, index) => {
                const isSelected = selectedUuids.has(item.uuid);
                return (
                  <tr key={item.uuid} className={`${isSelected ? 'row-selected' : ''}`}>
                    <td className="col-select">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelect(item.uuid)}
                        disabled={moving || retriggeringUuid !== null}
                        aria-label={`Select ${item.repo_full_name} #${item.pr_number}`}
                      />
                    </td>
                    <td className="col-position">{index + 1}</td>
                    <td>
                      <a href={repoUrl(item.repo_full_name)} target="_blank" rel="noopener noreferrer">
                        {item.repo_full_name}
                      </a>{' '}
                      <a href={prUrl(item.repo_full_name, item.pr_number)} target="_blank" rel="noopener noreferrer">
                        #{item.pr_number}
                      </a>
                      <span className="pr-title">{item.pr_title}</span>
                    </td>
                    <td>{formatRelativeFuture(item.not_before)}</td>
                    <td className="col-actions">
                      <button
                        className="btn-retrigger"
                        onClick={() => handleRetriggerNow(item.uuid)}
                        disabled={moving || retriggeringUuid !== null || paused}
                        aria-label={'Retrigger now for ' + item.repo_full_name + ' #' + item.pr_number}
                        title="Retrigger now"
                      >
                        ⚡
                      </button>
                      <button
                        className="btn-arrow"
                        onClick={() => moveSingle(item.uuid, 'up')}
                        disabled={moving || retriggeringUuid !== null}
                        aria-label="Move up"
                      >
                        ↑
                      </button>
                      <button
                        className="btn-arrow"
                        onClick={() => moveSingle(item.uuid, 'down')}
                        disabled={moving || retriggeringUuid !== null}
                        aria-label="Move down"
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
    </section>
  );
};

export default QueueOrder;
