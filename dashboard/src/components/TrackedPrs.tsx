import type { TrackedPrResponse } from '../../../src/types/index.js';
import { prUrl } from '../githubUrl.js';

import './TrackedPrs.css';

const TrackedPrs = ({ items, headingLevel }: { items: TrackedPrResponse[] | null; headingLevel: 'h2' | 'h3' }) => {
  const Heading = headingLevel;

  if (!items) return <div className="loading">Loading tracked PRs...</div>;

  return (
    <section>
      <Heading>Tracked PRs — {items.length}</Heading>
      {items.length === 0 ? (
        <p>No tracked PRs.</p>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Repo / PR</th>
              <th>Author</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={`${item.repo_full_name}#${item.pr_number}`}>
                <td>
                  <a href={prUrl(item.repo_full_name, item.pr_number)} target="_blank" rel="noopener noreferrer">
                    {item.title} (#{item.pr_number})
                  </a>
                </td>
                <td>{item.author_login}</td>
                <td>{item.last_review_state ? <span className="badge reviewed">Reviewed</span> : <span className="badge awaiting">Awaiting review</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
};

export default TrackedPrs;
