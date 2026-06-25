import type { PaginatedResponse, QueueItem } from '../api.js';
import { fetchQueue } from '../api.js';
import { formatDate } from '../formatDate.js';
import { prUrl, repoUrl } from '../githubUrl.js';

import Pagination from './Pagination.js';

import { useEffect, useState } from 'react';

const PAGE_SIZE = 20;

const QueueTable = () => {
  const [data, setData] = useState<PaginatedResponse<QueueItem> | null>(null);
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    fetchQueue(page, PAGE_SIZE)
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

  if (error) return <div className="error">Failed to load queue: {error}</div>;
  if (!data) return <div className="loading">Loading queue…</div>;

  const totalPages = Math.max(1, Math.ceil(data.total / data.pageSize));

  return (
    <section>
      <h2>Queue</h2>
      <table className="data-table">
        <thead>
          <tr>
            <th>Status</th>
            <th>Repo</th>
            <th>PR</th>
            <th>Scheduled For (UTC)</th>
            <th>Attempts</th>
          </tr>
        </thead>
        <tbody>
          {data.data.length === 0 ? (
            <tr>
              <td colSpan={5} className="empty-row">
                No queue items.
              </td>
            </tr>
          ) : (
            data.data.map((item) => (
              <tr key={item.id} className={`row-status-${item.status}`}>
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
                <td>{formatDate(item.scheduled_for)}</td>
                <td>{item.attempts}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
      <Pagination page={data.page} totalPages={totalPages} total={data.total} onPage={setPage} />
    </section>
  );
};

export default QueueTable;
