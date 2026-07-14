import { formatRelativeFuture } from '../../../src/utils/formatRelativeFuture.js';
import type { QueueItem } from '../api.js';
import { moveQueueItems, moveToTop, retriggerNow } from '../api.js';
import { prUrl } from '../githubUrl.js';

import ConfirmDialog from './ConfirmDialog.js';

import './QueueOrder.css';
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
        <p>No pending or retriggered items.</p>
      ) : (
        <>
          <div className="queue-order-toolbar">
            <button disabled={!hasSelection || moving || retriggeringUuid !== null || movingToTopUuid !== null} onClick={() => moveSelected('up')}>
              Move Up
            </button>
            <button disabled={!hasSelection || moving || retriggeringUuid !== null || movingToTopUuid !== null} onClick={() => moveSelected('down')}>
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
                    disabled={moving || retriggeringUuid !== null || movingToTopUuid !== null}
                    aria-label="Select all pending items"
                  />
                </th>
                <th className="col-position">#</th>
                <th>Pull Request</th>
                <th>Not Before</th>
                <th>Status</th>
                <th className="col-actions"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, index) => {
                const isRetriggered = item.status === 'retriggered';
                const isSelected = selectedUuids.has(item.uuid);
                return (
                  <tr
                    key={item.uuid}
                    className={`${isSelected ? 'row-selected' : ''} ${isRetriggered ? 'row-retriggered' : ''} ${index > 0 ? 'row-waiting' : ''}`}
                  >
                    <td className="col-select">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelect(item.uuid)}
                        disabled={moving || retriggeringUuid !== null || movingToTopUuid !== null}
                        aria-label={`Select ${item.pr_title}`}
                      />
                    </td>
                    <td className="col-position">{index + 1}</td>
                    <td>
                      <a href={prUrl(item.repo_full_name, item.pr_number)} target="_blank" rel="noopener noreferrer">
                        {item.pr_title} (#{item.pr_number})
                      </a>
                      {item.author_login !== '<unknown>' && <span className="pr-author"> by {item.author_login}</span>}
                      <br />
                      <span className="pr-repo-muted">{item.repo_full_name}</span>
                    </td>
                    <td>{formatRelativeFuture(item.not_before)}</td>
                    {isRetriggered ? (
                      <td>
                        <span className="status-pill retriggered">Awaiting review</span>
                      </td>
                    ) : index === 0 ? (
                      <td>
                        {new Date(item.not_before).getTime() <= Date.now() ? (
                          <span className="status-pill eligible">{formatRelativeFuture(item.not_before)}</span>
                        ) : (
                          <span className="status-pill cooldown">{formatRelativeFuture(item.not_before)}</span>
                        )}
                      </td>
                    ) : (
                      <td>
                        <span className="queue-order-carrots">{'🥕'.repeat(index)}</span>
                      </td>
                    )}
                    <td className="col-actions">
                      {!isRetriggered && (
                        <button
                          className="btn-retrigger"
                          onClick={() => handleRetriggerNow(item.uuid)}
                          disabled={moving || retriggeringUuid !== null || movingToTopUuid !== null}
                          aria-label={'Retrigger now for ' + item.pr_title}
                          title="Retrigger now"
                        >
                          ⚡
                        </button>
                      )}
                      <button
                        className="btn-arrow"
                        onClick={() => handleMoveToTop(item.uuid)}
                        disabled={moving || retriggeringUuid !== null || movingToTopUuid !== null}
                        aria-label="Move to top"
                      >
                        ⇈
                      </button>
                      <button
                        className="btn-arrow"
                        onClick={() => moveSingle(item.uuid, 'up')}
                        disabled={moving || retriggeringUuid !== null || movingToTopUuid !== null}
                        aria-label="Move up"
                      >
                        ↑
                      </button>
                      <button
                        className="btn-arrow"
                        onClick={() => moveSingle(item.uuid, 'down')}
                        disabled={moving || retriggeringUuid !== null || movingToTopUuid !== null}
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
