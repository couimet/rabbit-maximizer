import type { EventEntryResponse } from '../../../src/types/index.js';
import { formatDate } from '../../../src/utils/index.js';
import { fetchEvents, type PaginatedResponse } from '../api.js';
import { useErrorContext } from '../context/index.js';
import { prUrl, repoUrl } from '../githubUrl.js';
import { useTimezone, useTimezoneSuffix } from '../timezone.js';

import { Pagination } from './index.js';

import { useEffect, useState } from 'react';

const PAGE_SIZE = 50;

/** Build a summary string from an event's payload or fall back to correlation_id. */
const eventDetail = (event: EventEntryResponse): string => {
  if (event.payload && typeof event.payload === 'object' && Object.keys(event.payload).length > 0) {
    return JSON.stringify(event.payload);
  }
  return event.correlation_id;
};

const EventHistory = () => {
  const [data, setData] = useState<PaginatedResponse<EventEntryResponse> | null>(null);
  const [page, setPage] = useState(1);
  const { timezone } = useTimezone();
  const { reportError, dismissError } = useErrorContext();
  const suffix = useTimezoneSuffix();

  useEffect(() => {
    let cancelled = false;
    dismissError('event-history');
    fetchEvents(page, PAGE_SIZE)
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch((err: Error) => {
        if (!cancelled) reportError('event-history', err.message);
      });
    return () => {
      cancelled = true;
    };
  }, [page, dismissError, reportError]);

  if (!data) return <div className="loading">Loading events…</div>;

  const totalPages = Math.max(1, Math.ceil(data.total / data.pageSize));

  const seenHeaders = new Set<string>();
  const rows: React.ReactNode[] = [];

  for (const event of data.data) {
    const key = `${event.repo_full_name}#${event.pr_number}`;
    if (!seenHeaders.has(key)) {
      seenHeaders.add(key);
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
