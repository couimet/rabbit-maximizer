import { formatDate } from '../../../src/utils/formatDate.js';
import type { QueueItem } from '../api.js';
import { fetchQueueOrder, moveQueueItems } from '../api.js';
import { prUrl, repoUrl } from '../githubUrl.js';
import { useTimezone, useTimezoneSuffix } from '../timezone.js';

import { useEffect, useState } from 'react';

const QueueOrder = () => {
  const [items, setItems] = useState<QueueItem[] | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [moving, setMoving] = useState(false);
  const { timezone } = useTimezone();
  const suffix = useTimezoneSuffix();

  const [moveError, setMoveError] = useState<string | null>(null);

  const loadOrder = () => {
    setError(null);
    fetchQueueOrder()
      .then((res) => setItems(res.data))
      .catch((err: Error) => setError(err.message));
  };

  useEffect(() => {
    loadOrder();
  }, []);

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    /* c8 ignore next 2 — type guard: toggleSelectAll only rendered when items is non-null */
    if (!items) return;
    if (selectedIds.size === items.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(items.map((item) => item.id)));
    }
  };

  const handleMove = (direction: 'up' | 'down', ids: number[]) => {
    setMoving(true);
    setMoveError(null);
    moveQueueItems(ids, direction)
      .then((res) => {
        if (Array.isArray(res.data)) {
          setItems(res.data);
        } else {
          setMoveError('Unexpected response from server');
        }
        setSelectedIds(new Set());
        setMoving(false);
      })
      .catch((err: Error) => {
        setMoveError(err.message);
        setMoving(false);
      });
  };

  const moveSingle = (id: number, direction: 'up' | 'down') => handleMove(direction, [id]);
  const moveSelected = (direction: 'up' | 'down') => {
    /* c8 ignore next 2 — unreachable: toolbar buttons are disabled when nothing is selected */
    if (selectedIds.size === 0) return;
    handleMove(direction, Array.from(selectedIds));
  };

  if (error) return <div className="error">Failed to load queue order: {error}</div>;
  if (!items) return <div className="loading">Loading queue order…</div>;

  const hasSelection = selectedIds.size > 0;
  const allSelected = items.length > 0 && selectedIds.size === items.length;

  return (
    <section>
      <h2>Queue Order</h2>
      {moveError && <div className="error">Move failed: {moveError}</div>}
      {items.length === 0 ? (
        <p>No pending items.</p>
      ) : (
        <>
          <div className="queue-order-toolbar">
            <button disabled={!hasSelection || moving} onClick={() => moveSelected('up')}>
              Move Up
            </button>
            <button disabled={!hasSelection || moving} onClick={() => moveSelected('down')}>
              Move Down
            </button>
          </div>
          <table className="data-table queue-order-table">
            <thead>
              <tr>
                <th className="col-select">
                  <input type="checkbox" checked={allSelected} onChange={toggleSelectAll} disabled={moving} />
                </th>
                <th className="col-position">#</th>
                <th>Status</th>
                <th>Repo</th>
                <th>PR</th>
                <th>Not Before{suffix}</th>
                <th className="col-actions"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, index) => {
                const isSelected = selectedIds.has(item.id);
                return (
                  <tr key={item.id} className={`${isSelected ? 'row-selected' : ''}`}>
                    <td className="col-select">
                      <input type="checkbox" checked={isSelected} onChange={() => toggleSelect(item.id)} disabled={moving} />
                    </td>
                    <td className="col-position">{index + 1}</td>
                    <td>{item.status}</td>
                    <td>
                      <a href={repoUrl(item.repo_full_name)} target="_blank" rel="noopener noreferrer">
                        {item.repo_full_name}
                      </a>
                    </td>
                    <td>
                      <a href={prUrl(item.repo_full_name, item.pr_number)} target="_blank" rel="noopener noreferrer">
                        #{item.pr_number}
                      </a>
                    </td>
                    <td>{formatDate(item.not_before, timezone)}</td>
                    <td className="col-actions">
                      <button className="btn-arrow" onClick={() => moveSingle(item.id, 'up')} disabled={moving} aria-label="Move up">
                        ↑
                      </button>
                      <button className="btn-arrow" onClick={() => moveSingle(item.id, 'down')} disabled={moving} aria-label="Move down">
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
