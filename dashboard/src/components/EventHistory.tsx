import type { EventEntry, PaginatedResponse } from '../api';
import { fetchEvents } from '../api';
import { formatDate } from '../formatDate';
import { useEffect, useMemo, useState } from 'react';

const PAGE_SIZE = 20;

interface PrGroup {
  key: string;
  repo_full_name: string;
  pr_number: number;
  events: EventEntry[];
}

const EventHistory = () => {
  const [data, setData] = useState<PaginatedResponse<EventEntry> | null>(null);
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    fetchEvents(page, PAGE_SIZE)
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, [page]);

  const groups = useMemo(() => {
    if (!data) return [];
    const map = new Map<string, PrGroup>();
    for (const event of data.data) {
      const key = `${event.repo_full_name}#${event.pr_number}`;
      let group = map.get(key);
      if (!group) {
        group = { key, repo_full_name: event.repo_full_name, pr_number: event.pr_number, events: [] };
        map.set(key, group);
      }
      group.events.push(event);
    }
    return [...map.values()];
  }, [data]);

  if (error) return <div className="error">Failed to load events: {error}</div>;
  if (!data) return <div className="loading">Loading events…</div>;

  const totalPages = Math.max(1, Math.ceil(data.total / data.pageSize));

  return (
    <section>
      <h2>Event History</h2>
      {groups.length === 0 ? (
        <p>No events.</p>
      ) : (
        groups.map((group) => (
          <div key={group.key} className="event-group">
            <h3>
              {group.repo_full_name}{' '}
              <a href={`https://github.com/${group.repo_full_name}/pull/${group.pr_number}`} target="_blank" rel="noopener noreferrer">
                #{group.pr_number}
              </a>
            </h3>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Time (UTC)</th>
                  <th>Type</th>
                  <th>Correlation ID</th>
                </tr>
              </thead>
              <tbody>
                {group.events.map((event) => (
                  <tr key={event.id} className={`row-event-${event.type}`}>
                    <td>{formatDate(event.ts)}</td>
                    <td>{event.type}</td>
                    <td className="correlation-id">{event.correlation_id}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))
      )}
      <Pagination page={data.page} totalPages={totalPages} total={data.total} onPage={setPage} />
    </section>
  );
};

const Pagination = ({ page, totalPages, total, onPage }: { page: number; totalPages: number; total: number; onPage: (p: number) => void }) => (
  <div className="pagination">
    <button disabled={page <= 1} onClick={() => onPage(page - 1)}>
      Previous
    </button>
    <span className="page-info">
      Page {page} of {totalPages} ({total} total)
    </span>
    <button disabled={page >= totalPages} onClick={() => onPage(page + 1)}>
      Next
    </button>
  </div>
);

export default EventHistory;
