import type { EventEntryResponse } from '../../../src/types/index.js';
import { formatDate } from '../../../src/utils/index.js';
import { fetchEvents } from '../api.js';
import { useErrorContext } from '../context/index.js';
import { prUrl } from '../githubUrl.js';
import { useTimezone } from '../timezone.js';

import { deriveEventFilterOptions, eventMatchesFilter, findFilterContradiction } from './eventFilterOptions.js';
import { EVENT_FAMILY_LABEL, getEventTypeMeta, KNOWN_EVENT_FAMILIES, summarizeEvent } from './index.js';

import './EventHistory.css';
import './eventVocabulary.css';
import { useEffect, useState } from 'react';

const PAGE_SIZE = 50;

const dayOf = (iso: string, timezone: string): string => formatDate(iso, timezone).slice(0, 10);
const clockTime = (iso: string, timezone: string): string => formatDate(iso, timezone).slice(11);

const toggleSetValue = (set: ReadonlySet<string>, value: string): Set<string> => {
  const next = new Set(set);
  if (next.has(value)) {
    next.delete(value);
  } else {
    next.add(value);
  }
  return next;
};

const EventHistory = () => {
  const [items, setItems] = useState<EventEntryResponse[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedRepos, setSelectedRepos] = useState<ReadonlySet<string>>(new Set());
  const [selectedPrs, setSelectedPrs] = useState<ReadonlySet<string>>(new Set());
  const [prQuery, setPrQuery] = useState('');
  const { timezone } = useTimezone();
  const { reportError, dismissError } = useErrorContext();

  useEffect(() => {
    let cancelled = false;
    fetchEvents(1, PAGE_SIZE)
      .then((d) => {
        /* c8 ignore next 2 — cleanup guard: unmount mid-flight leaves state untouched */
        if (cancelled) return;
        dismissError('event-history');
        setTotal(d.total);
        setItems(d.data);
        setLoading(false);
      })
      .catch((err: Error) => {
        /* c8 ignore next 2 — cleanup guard: unmount mid-flight leaves state untouched */
        if (cancelled) return;
        reportError('event-history', 'Event history', err.message);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [dismissError, reportError]);

  const handleLoadMore = () => {
    setLoading(true);
    const nextPage = page + 1;
    fetchEvents(nextPage, PAGE_SIZE)
      .then((d) => {
        dismissError('event-history');
        setTotal(d.total);
        setPage(nextPage);
        setItems((prev) => {
          // Newest-first offset pagination: an event written between two loads can shift onto both pages.
          const loadedIds = new Set(prev.map((event) => event.id));
          return [...prev, ...d.data.filter((event) => !loadedIds.has(event.id))];
        });
        setLoading(false);
      })
      .catch((err: Error) => {
        reportError('event-history', 'Event history', err.message);
        setLoading(false);
      });
  };

  if (loading && items.length === 0) return <div className="loading">Loading events…</div>;
  if (items.length === 0) return <p>No events.</p>;

  const options = deriveEventFilterOptions(items);
  const filterActive = selectedRepos.size > 0 || selectedPrs.size > 0;
  const prQueryNorm = prQuery.trim().toLowerCase();
  const filteredEvents = items.filter((event) => eventMatchesFilter(event, selectedRepos, selectedPrs));
  const contradiction = findFilterContradiction(selectedRepos, selectedPrs);
  const visiblePrOptions = options.prs.filter((prLabel) => selectedPrs.has(prLabel) || prLabel.toLowerCase().includes(prQueryNorm));

  const toggleRepo = (repo: string) => {
    setSelectedRepos((prev) => toggleSetValue(prev, repo));
  };
  const togglePr = (prLabel: string) => {
    setSelectedPrs((prev) => toggleSetValue(prev, prLabel));
  };

  const hasMore = total !== null && items.length < total;
  const newestDay = dayOf(items[0].ts, timezone);

  const renderChip = (key: string, label: string, selected: boolean, onClick: () => void) => (
    <button key={key} type="button" aria-pressed={selected} className={`filter-chip${selected ? ' selected' : ''}`} onClick={onClick}>
      {label}
    </button>
  );

  return (
    <section>
      <div className="timeline-head">
        <h2>Event History</h2>
        {total !== null && (
          <div className="timeline-meta">
            {filterActive ? (
              <>
                <span>
                  showing {filteredEvents.length} of {items.length} loaded
                </span>
                <span className="timeline-scope-note">filter covers events loaded so far</span>
              </>
            ) : (
              <span>
                showing {items.length} of {total}
              </span>
            )}
            <span>newest first</span>
          </div>
        )}
      </div>

      <div className="event-legend">
        {KNOWN_EVENT_FAMILIES.map((family) => (
          <span key={family}>
            <i className={`vocab-dot ${family}`} aria-hidden="true" />
            {EVENT_FAMILY_LABEL[family]}
          </span>
        ))}
      </div>

      <div className="event-filter">
        <div className="filter-group">
          <span className="filter-group-label">Repos</span>
          <div className="filter-chips">{options.repos.map((repo) => renderChip(repo, repo, selectedRepos.has(repo), () => toggleRepo(repo)))}</div>
        </div>
        <div className="filter-group">
          <span className="filter-group-label">Pull requests</span>
          <input
            type="search"
            className="filter-search"
            aria-label="Find a pull request"
            placeholder="Find a PR…"
            value={prQuery}
            onChange={(event) => setPrQuery(event.target.value)}
          />
          <div className="filter-chips">
            {visiblePrOptions.map((prLabel) => renderChip(prLabel, prLabel, selectedPrs.has(prLabel), () => togglePr(prLabel)))}
          </div>
        </div>
      </div>

      {contradiction === null ? (
        <div className="timeline">
          {filteredEvents.map((event) => {
            const meta = getEventTypeMeta(event.type);
            const reading = summarizeEvent(event.type, event.payload);
            const day = dayOf(event.ts, timezone);
            const showCorrelation = meta.family === 'unknown' && reading.length === 0;
            return (
              <div key={event.id} className="tl-entry">
                <div className="tl-time">
                  {day !== newestDay && <span className="date-only">{day}</span>}
                  <span className="clock">{clockTime(event.ts, timezone)}</span>
                </div>
                <div className="tl-rail">
                  <span className={`tl-node ${meta.family}`} aria-hidden="true" />
                </div>
                <div className="tl-body">
                  <a className="pr-link" href={prUrl(event.repo_full_name, event.pr_number)} target="_blank" rel="noopener noreferrer">
                    {event.repo_full_name}#{event.pr_number}
                  </a>
                  <div className="tl-phrase">{meta.label}</div>
                  {(reading.length > 0 || showCorrelation) && (
                    <div className="tl-meta">
                      {reading.map((token, index) =>
                        token.kind === 'link' ? (
                          <a key={index} className="comment-link" href={token.url} target="_blank" rel="noopener noreferrer">
                            {token.value}
                          </a>
                        ) : (
                          <span key={index}>{token.value}</span>
                        ),
                      )}
                      {showCorrelation && event.correlation_id}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="filter-empty">{contradiction.prLabel} isn&apos;t in your repo filter, so nothing can match</p>
      )}

      {hasMore && (
        <div className="load-more-container">
          <button className="load-more-button" onClick={handleLoadMore} disabled={loading}>
            {loading ? 'Loading…' : 'Show earlier events'}
          </button>
        </div>
      )}
    </section>
  );
};

export default EventHistory;
