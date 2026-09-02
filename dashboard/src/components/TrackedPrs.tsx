import type { TrackedPrResponse } from '../../../src/types/index.js';
import { prUrl } from '../githubUrl.js';

import './TrackedPrs.css';
import { useState } from 'react';

const TrackedPrs = ({ items, headingLevel }: { items: TrackedPrResponse[] | null; headingLevel: 'h2' | 'h3' }) => {
  const Heading = headingLevel;
  const [explanationOpen, setExplanationOpen] = useState(false);

  if (!items) return <div className="loading">Loading tracked PRs...</div>;

  return (
    <section>
      <Heading>Tracked PRs — {items.length}</Heading>
      <button
        type="button"
        className="tracked-prs-explanation-toggle"
        aria-expanded={explanationOpen}
        aria-controls={explanationOpen ? 'tracked-prs-explanation' : undefined}
        onClick={() => setExplanationOpen((prev) => !prev)}
      >
        Why is this list here?
      </button>
      {explanationOpen && (
        <p id="tracked-prs-explanation" className="tracked-prs-explanation">
          Open PRs not acknowledged by CodeRabbit and without an active item. Rabbit Maximizer only acts once CodeRabbit acknowledges a PR, so these PRs sit
          outside the queue's flow; the list appears below the queue.
        </p>
      )}
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
                    {item.repo_full_name} — {item.title} (#{item.pr_number})
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
