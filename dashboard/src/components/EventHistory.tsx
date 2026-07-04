import { formatDate } from '../../../src/utils/formatDate.js';
import type { EventEntry, PaginatedResponse } from '../api.js';
import { fetchEvents } from '../api.js';
import { prUrl, repoUrl } from '../githubUrl.js';
import { useTimezone, useTimezoneSuffix } from '../timezone.js';

import Pagination from './Pagination.js';

import { useEffect, useState } from 'react';

const PAGE_SIZE = 50;

/** Build a summary string from an event's payload or fall back to correlation_id. */
const eventDetail = (event: EventEntry): string => {
  if (event.payload && typeof event.payload === 'object' && Object.keys(event.payload).length > 0) {
    return JSON.stringify(event.payload);
  }
  return event.correlation_id;
};

const EventHistory = () => {
  const [data, setData] = useState<PaginatedResponse<EventEntry> | null>(null);
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const { timezone } = useTimezone();
  const suffix = useTimezoneSuffix();

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

  if (error) return <div className="error">Failed to load events: {error}</div>;
  if (!data) return <div className="loading">Loading events…</div>;

  const totalPages = Math.max(1, Math.ceil(data.total / data.pageSize));

  let lastKey = '';
  const rows: React.ReactNode[] = [];

  for (const event of data.data) {
    const key = `${event.repo_full_name}#${event.pr_number}`;
    if (key !== lastKey) {
      rows.push(
        <tr key={`header-${key}`} style={{ background: '#f4f0e7', borderTop: '2px solid #e3d6c3' }}>
          <td colSpan={2} style={{ whiteSpace: 'nowrap' }}>
            <a href={repoUrl(event.repo_full_name)} target="_blank" rel="noopener noreferrer">
              {event.repo_full_name}
            </a>{' '}
            <a href={prUrl(event.repo_full_name, event.pr_number)} target="_blank" rel="noopener noreferrer">
              #{event.pr_number}
            </a>
          </td>
          <td colSpan={3} />
        </tr>,
      );
      lastKey = key;
    }
    rows.push(
      <tr key={event.id} className={`row-event-${event.type}`}>
        <td colSpan={2} />
        <td>
          <span className={`badge ${event.type}`}>{event.type}</span>
        </td>
        <td style={{ whiteSpace: 'nowrap' }}>{formatDate(event.ts, timezone)}</td>
        <td className="correlation-id">{eventDetail(event)}</td>
      </tr>,
    );
  }

  return (
    <section>
      <h2>Event History</h2>
      {data.data.length === 0 ? (
        <p>No events.</p>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th colSpan={2} style={{ whiteSpace: 'nowrap' }}>
                Repository / PR
              </th>
              <th>Type</th>
              <th style={{ whiteSpace: 'nowrap' }}>When{suffix}</th>
              <th style={{ width: '100%' }}>Detail</th>
            </tr>
          </thead>
          <tbody>{rows}</tbody>
        </table>
      )}
      <Pagination page={data.page} totalPages={totalPages} total={data.total} onPage={setPage} />
    </section>
  );
};

export default EventHistory;
