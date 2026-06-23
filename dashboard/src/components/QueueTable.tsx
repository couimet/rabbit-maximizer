import type { PaginatedResponse, QueueItem } from '../api';
import { fetchQueue, formatDate } from '../api';
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
            <th>Scheduled For</th>
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
                <td>{item.repo_full_name}</td>
                <td>
                  <a href={`https://github.com/${item.repo_full_name}/pull/${item.pr_number}`} target="_blank" rel="noopener noreferrer">
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

const Pagination = ({
  page,
  totalPages,
  total,
  onPage,
}: {
  page: number;
  totalPages: number;
  total: number;
  onPage: (p: number) => void;
}) => (
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

export default QueueTable;
