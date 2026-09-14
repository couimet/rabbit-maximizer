/** @jest-environment jsdom */

import { ErrorProvider, EventHistory, GlobalErrorBanner, TimezoneProvider } from '../../dashboard/src/index.js';
import { formatDate } from '../../src/utils/index.js';
import { createMockFetch, drainMicrotasks } from '../helpers/index.js';

import '@testing-library/jest-dom/jest-globals';
import { getUniqueDate, getUniqueGitHubRepoRef, getUniqueInt, getUuid } from '@couimet/dynamic-testing';
import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react';

const renderEventHistory = () =>
  render(
    <TimezoneProvider>
      <ErrorProvider>
        <GlobalErrorBanner />
        <EventHistory />
      </ErrorProvider>
    </TimezoneProvider>,
  );

const PAGE_SIZE = 50;
const MAIN_REPO = 'couimet/rabbit-maximizer';
const RUN_ID = getUuid();
const OTHER_RUN_ID = getUuid();
const OTHER_REPO = 'couimet/other';
const MAIN_PR = getUniqueInt();
const OTHER_PR = getUniqueInt();
const DETECTED_PHRASE = 'Review-limit detected';
const SOURCE_COMMENT_URL = 'https://github.com/couimet/rabbit-maximizer/pull/343#issuecomment-227104133';
const RETRIGGERED_COMMENT_URL = 'https://github.com/couimet/rabbit-maximizer/pull/343#issuecomment-227104521';

const NEWEST_TS = '2026-06-23T14:30:00.000Z';
const ENQUEUED_TS = '2026-06-23T14:25:00.000Z';
const RETRIGGERED_TS = '2026-06-23T14:20:00.000Z';
const OLDER_TS = '2026-06-22T23:58:12.000Z';
const tsClock = (iso: string): string => formatDate(iso, 'UTC').slice(11);
const tsDay = (iso: string): string => formatDate(iso, 'UTC').slice(0, 10);

/** @testFixture */
const makeEvent = (over: Record<string, unknown> = {}) => ({
  id: getUniqueInt(),
  uuid: getUuid(),
  ts: getUniqueDate().toISOString(),
  type: 'detected',
  repo_full_name: getUniqueGitHubRepoRef().fullName,
  pr_number: getUniqueInt(),
  correlation_id: getUuid(),
  request_id: getUuid(),
  version: '1.0.0',
  metadata: {},
  payload: {},
  ...over,
});

// Enough hops to settle fetch → fetchJson resume → res.json() → .then; extra ticks are inert.
const STALE_RESPONSE_DRAIN = 10;

interface DeferredFetch {
  resolve: (url: string, body: unknown) => void;
  reject: (url: string, error: Error) => void;
}

/** Holds every response open so a test can settle requests out of order. Returns a settler keyed by request URL. */
const createDeferredFetch = (): DeferredFetch => {
  const pending = new Map<string, { resolve: (body: unknown) => void; reject: (error: Error) => void }>();
  globalThis.fetch = jest.fn((url: string) => {
    return new Promise<Response>((resolve, reject) => {
      pending.set(url, {
        resolve: (body) => resolve({ ok: true, status: 200, json: () => Promise.resolve(body) } as Response),
        reject,
      });
    });
  }) as unknown as typeof fetch;
  const take = (url: string) => {
    const deferred = pending.get(url);
    if (!deferred) throw new Error(`No pending request for ${url}`);
    pending.delete(url);
    return deferred;
  };
  return {
    resolve: (url, body) => take(url).resolve(body),
    reject: (url, error) => take(url).reject(error),
  };
};

const FOUR_EVENTS_BODY = {
  data: [
    makeEvent({
      id: 1,
      type: 'detected',
      correlation_id: 'corr-001',
      repo_full_name: MAIN_REPO,
      pr_number: MAIN_PR,
      ts: NEWEST_TS,
      payload: {
        detected_via: 'search',
        coderabbit_run_id: '4f2e91a2',
        source_comment_url: SOURCE_COMMENT_URL,
      },
    }),
    makeEvent({
      id: 2,
      type: 'enqueued',
      correlation_id: 'corr-001',
      repo_full_name: MAIN_REPO,
      pr_number: MAIN_PR,
      ts: ENQUEUED_TS,
    }),
    makeEvent({
      id: 3,
      type: 'retriggered',
      correlation_id: 'corr-001',
      repo_full_name: MAIN_REPO,
      pr_number: MAIN_PR,
      ts: RETRIGGERED_TS,
      payload: {
        source_comment_url: SOURCE_COMMENT_URL,
        retriggered_comment_url: RETRIGGERED_COMMENT_URL,
      },
    }),
    makeEvent({
      id: 4,
      type: 'failed',
      correlation_id: 'corr-002',
      repo_full_name: OTHER_REPO,
      pr_number: OTHER_PR,
      ts: OLDER_TS,
      payload: { retrigger_count: 10, max: 10 },
    }),
  ],
  total: 4,
  page: 1,
  pageSize: PAGE_SIZE,
};

describe('EventHistory', () => {
  afterEach(() => {
    localStorage.clear();
  });

  describe('loading', () => {
    it('shows loading text while fetch is in-flight', () => {
      globalThis.fetch = jest.fn(() => new Promise(() => {})) as unknown as typeof fetch;
      renderEventHistory();
      expect(screen.getByText('Loading events…')).toBeInTheDocument();
    });
  });

  describe('data', () => {
    beforeEach(() => {
      createMockFetch(200, FOUR_EVENTS_BODY);
    });

    it('renders one newest-first timeline entry per event', async () => {
      renderEventHistory();
      await screen.findByText(DETECTED_PHRASE);
      expect(screen.getByText('Enqueued')).toBeInTheDocument();
      expect(screen.getByText('Retrigger posted')).toBeInTheDocument();
      expect(screen.getByText('Failed')).toBeInTheDocument();
      expect(screen.getAllByRole('link', { name: `${MAIN_REPO}#${MAIN_PR}` })).toHaveLength(3);
      expect(screen.getByRole('link', { name: `${OTHER_REPO}#${OTHER_PR}` })).toBeInTheDocument();
    });

    it('renders plain-language readings under each entry label', async () => {
      renderEventHistory();
      await screen.findByText('via comment search');
      expect(screen.getByText('run 4f2e91a2')).toBeInTheDocument();
      expect(screen.getByText('after 10 of 10 retriggers')).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'source comment 227104133' })).toBeInTheDocument();
    });

    it('renders comment ids as links that open in a new tab', async () => {
      renderEventHistory();
      await screen.findByText('via comment search');

      const detectedComment = screen.getByRole('link', { name: 'comment 227104133' });
      expect(detectedComment).toHaveAttribute('href', SOURCE_COMMENT_URL);
      expect(detectedComment).toHaveAttribute('target', '_blank');

      const sourceComment = screen.getByRole('link', { name: 'source comment 227104133' });
      expect(sourceComment).toHaveAttribute('href', SOURCE_COMMENT_URL);
      expect(sourceComment).toHaveAttribute('target', '_blank');

      const retriggeredComment = screen.getByRole('link', { name: 'comment 227104521' });
      expect(retriggeredComment).toHaveAttribute('href', RETRIGGERED_COMMENT_URL);
      expect(retriggeredComment).toHaveAttribute('target', '_blank');
    });

    it('shows the running count and newest-first ordering in the header', async () => {
      renderEventHistory();
      await screen.findByText('showing 4 of 4');
      expect(screen.getByText('newest first')).toBeInTheDocument();
    });

    it('renders the family legend', async () => {
      renderEventHistory();
      await screen.findByText(DETECTED_PHRASE);
      expect(screen.getByText('lifecycle')).toBeInTheDocument();
      expect(screen.getByText('failure')).toBeInTheDocument();
      expect(screen.getByText('verdict')).toBeInTheDocument();
      expect(screen.getByText('run-id bookkeeping')).toBeInTheDocument();
    });

    it('renders PR links opening in new tabs', async () => {
      renderEventHistory();
      await screen.findByText(DETECTED_PHRASE);

      const prLink = screen.getAllByRole('link', { name: `${MAIN_REPO}#${MAIN_PR}` })[0];
      expect(prLink).toHaveAttribute('href', `https://github.com/${MAIN_REPO}/pull/${MAIN_PR}`);
      expect(prLink).toHaveAttribute('target', '_blank');
    });

    it('shows a day caption only on entries older than the newest day', async () => {
      renderEventHistory();
      await screen.findByText('showing 4 of 4');
      expect(screen.getByText(tsDay(OLDER_TS))).toBeInTheDocument();
      expect(screen.queryByText(tsDay(NEWEST_TS))).not.toBeInTheDocument();
    });

    it('shows the clock time for every entry', async () => {
      renderEventHistory();
      await screen.findByText('showing 4 of 4');
      expect(screen.getByText(tsClock(NEWEST_TS))).toBeInTheDocument();
      expect(screen.getByText(tsClock(ENQUEUED_TS))).toBeInTheDocument();
      expect(screen.getByText(tsClock(RETRIGGERED_TS))).toBeInTheDocument();
      expect(screen.getByText(tsClock(OLDER_TS))).toBeInTheDocument();
    });

    it('shows no reading line for an enqueued entry with an empty payload', async () => {
      renderEventHistory();
      await screen.findByText('showing 4 of 4');
      const phrase = screen.getByText('Enqueued');
      expect(phrase.nextElementSibling).toBeNull();
    });
  });

  describe('unknown type', () => {
    it('falls back to correlation_id for an unrecognized event type', async () => {
      createMockFetch(200, {
        data: [makeEvent({ id: 50, type: 'future_event_type', correlation_id: 'fallback-99', payload: {} })],
        total: 1,
        page: 1,
        pageSize: PAGE_SIZE,
      });
      renderEventHistory();
      await screen.findByText('fallback-99');
      expect(screen.getByText('future_event_type')).toBeInTheDocument();
    });
  });

  describe('empty', () => {
    it('shows empty message when no events exist', async () => {
      createMockFetch(200, { data: [], total: 0, page: 1, pageSize: PAGE_SIZE });
      renderEventHistory();
      await screen.findByText('No events.');
    });
  });

  describe('load more', () => {
    it('fetches the next page and appends entries when Show earlier events is clicked', async () => {
      createMockFetch(200, { data: [makeEvent({ id: 1, type: 'enqueued' })], total: 100, page: 1, pageSize: PAGE_SIZE });
      renderEventHistory();
      await screen.findByText('Enqueued');
      expect(screen.getByText('showing 1 of 100')).toBeInTheDocument();

      createMockFetch(200, {
        data: [makeEvent({ id: 99, type: 'coderabbit_review_approved', ts: NEWEST_TS })],
        total: 100,
        page: 2,
        pageSize: PAGE_SIZE,
      });
      fireEvent.click(screen.getByText('Show earlier events'));
      await screen.findByText('Review approved');
      expect(screen.getByText('Enqueued')).toBeInTheDocument();
      expect(screen.getByText('showing 2 of 100')).toBeInTheDocument();
    });

    it('omits the button once every event is loaded', async () => {
      createMockFetch(200, { data: [makeEvent({ id: 1, type: 'enqueued' })], total: 1, page: 1, pageSize: PAGE_SIZE });
      renderEventHistory();
      await screen.findByText('Enqueued');
      expect(screen.queryByText('Show earlier events')).not.toBeInTheDocument();
    });

    it('shows an error banner when the next page fails', async () => {
      createMockFetch(200, { data: [makeEvent({ id: 1, type: 'enqueued' })], total: 100, page: 1, pageSize: PAGE_SIZE });
      renderEventHistory();
      await screen.findByText('Enqueued');

      createMockFetch(500, { error: 'Internal server error' });
      fireEvent.click(screen.getByText('Show earlier events'));
      await screen.findByText('Event history: Internal server error');
    });

    it('retries the same page after a failed load', async () => {
      createMockFetch(200, { data: [makeEvent({ id: 1, type: 'enqueued' })], total: 100, page: 1, pageSize: PAGE_SIZE });
      renderEventHistory();
      await screen.findByText('Enqueued');

      createMockFetch(500, { error: 'Internal server error' });
      fireEvent.click(screen.getByText('Show earlier events'));
      await screen.findByText('Event history: Internal server error');

      createMockFetch(200, {
        data: [makeEvent({ id: 99, type: 'coderabbit_review_approved', ts: NEWEST_TS })],
        total: 100,
        page: 2,
        pageSize: PAGE_SIZE,
      });
      fireEvent.click(screen.getByText('Show earlier events'));
      await screen.findByText('Review approved');

      expect(globalThis.fetch).toHaveBeenCalledWith('/api/events?page=2&pageSize=50', undefined);
    });

    it('does not append an event already loaded', async () => {
      createMockFetch(200, { data: [makeEvent({ id: 1, type: 'enqueued' })], total: 100, page: 1, pageSize: PAGE_SIZE });
      renderEventHistory();
      await screen.findByText('Enqueued');

      createMockFetch(200, {
        data: [makeEvent({ id: 1, type: 'enqueued', ts: NEWEST_TS }), makeEvent({ id: 99, type: 'coderabbit_review_approved' })],
        total: 100,
        page: 2,
        pageSize: PAGE_SIZE,
      });
      fireEvent.click(screen.getByText('Show earlier events'));
      await screen.findByText('Review approved');

      expect(screen.getAllByText('Enqueued')).toHaveLength(1);
      expect(screen.getByText('showing 2 of 100')).toBeInTheDocument();
    });
  });

  describe('filter', () => {
    beforeEach(() => {
      createMockFetch(200, FOUR_EVENTS_BODY);
    });

    it('auto-populates repo and PR chips from the loaded rows', async () => {
      renderEventHistory();
      await screen.findByText('showing 4 of 4');

      expect(screen.getByRole('button', { name: MAIN_REPO })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: OTHER_REPO })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: `${MAIN_REPO}#${MAIN_PR}` })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: `${OTHER_REPO}#${OTHER_PR}` })).toBeInTheDocument();
    });

    it('narrows the timeline to a selected repo and restores it when deselected', async () => {
      renderEventHistory();
      await screen.findByText('showing 4 of 4');

      const repoChip = screen.getByRole('button', { name: MAIN_REPO });
      fireEvent.click(repoChip);

      expect(await screen.findByText('showing 3 of 4 loaded')).toBeInTheDocument();
      expect(screen.getByText('filter covers events loaded so far')).toBeInTheDocument();
      expect(repoChip).toHaveAttribute('aria-pressed', 'true');
      expect(screen.getByText(DETECTED_PHRASE)).toBeInTheDocument();
      expect(screen.queryByText('Failed')).not.toBeInTheDocument();

      fireEvent.click(repoChip);
      expect(await screen.findByText('showing 4 of 4')).toBeInTheDocument();
      expect(screen.queryByText('filter covers events loaded so far')).not.toBeInTheDocument();
      expect(repoChip).toHaveAttribute('aria-pressed', 'false');
      expect(screen.getByText('Failed')).toBeInTheDocument();
    });

    it('filters by a PR on its own without picking its repo first', async () => {
      renderEventHistory();
      await screen.findByText('showing 4 of 4');

      fireEvent.click(screen.getByRole('button', { name: `${OTHER_REPO}#${OTHER_PR}` }));

      expect(await screen.findByText('showing 1 of 4 loaded')).toBeInTheDocument();
      expect(screen.getByText('Failed')).toBeInTheDocument();
      expect(screen.queryByText('Enqueued')).not.toBeInTheDocument();
    });

    it('keeps only rows matching both axes when the selections are consistent', async () => {
      renderEventHistory();
      await screen.findByText('showing 4 of 4');

      fireEvent.click(screen.getByRole('button', { name: MAIN_REPO }));
      fireEvent.click(screen.getByRole('button', { name: `${MAIN_REPO}#${MAIN_PR}` }));

      expect(await screen.findByText('showing 3 of 4 loaded')).toBeInTheDocument();
      expect(screen.queryByText('Failed')).not.toBeInTheDocument();
    });

    it('calls out a contradictory repo/PR selection by naming the conflicting PR', async () => {
      renderEventHistory();
      await screen.findByText('showing 4 of 4');

      fireEvent.click(screen.getByRole('button', { name: MAIN_REPO }));
      fireEvent.click(screen.getByRole('button', { name: `${OTHER_REPO}#${OTHER_PR}` }));

      expect(await screen.findByText(`${OTHER_REPO}#${OTHER_PR} isn't in your repo filter, so nothing can match`)).toBeInTheDocument();
      expect(screen.getByText('showing 0 of 4 loaded')).toBeInTheDocument();
      expect(screen.queryByText('Enqueued')).not.toBeInTheDocument();
      expect(screen.queryByText('Failed')).not.toBeInTheDocument();
    });

    it('narrows visible PR chips as the PR search is typed', async () => {
      renderEventHistory();
      await screen.findByText('showing 4 of 4');

      fireEvent.change(screen.getByRole('searchbox', { name: 'Find a pull request' }), {
        target: { value: 'rabbit-maximizer' },
      });

      expect(screen.getByRole('button', { name: `${MAIN_REPO}#${MAIN_PR}` })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: `${OTHER_REPO}#${OTHER_PR}` })).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: OTHER_REPO })).toBeInTheDocument();
    });

    it('keeps a selected PR chip visible even when the search no longer matches it', async () => {
      renderEventHistory();
      await screen.findByText('showing 4 of 4');

      fireEvent.click(screen.getByRole('button', { name: `${MAIN_REPO}#${MAIN_PR}` }));
      const search = screen.getByRole('searchbox', { name: 'Find a pull request' });
      fireEvent.change(search, { target: { value: 'zzz' } });

      expect(await screen.findByText('showing 3 of 4 loaded')).toBeInTheDocument();
      const selectedChip = screen.getByRole('button', { name: `${MAIN_REPO}#${MAIN_PR}` });
      expect(selectedChip).toHaveAttribute('aria-pressed', 'true');
      expect(screen.queryByRole('button', { name: `${OTHER_REPO}#${OTHER_PR}` })).not.toBeInTheDocument();

      fireEvent.change(search, { target: { value: '' } });
      expect(screen.getByRole('button', { name: `${OTHER_REPO}#${OTHER_PR}` })).toBeInTheDocument();
    });

    it('grows the chip options when Show earlier events appends events from a new repo', async () => {
      createMockFetch(200, {
        data: [makeEvent({ id: 1, type: 'enqueued', repo_full_name: MAIN_REPO, pr_number: MAIN_PR })],
        total: 100,
        page: 1,
        pageSize: PAGE_SIZE,
      });
      renderEventHistory();
      await screen.findByText('Enqueued');
      expect(screen.getByRole('button', { name: MAIN_REPO })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: OTHER_REPO })).not.toBeInTheDocument();

      createMockFetch(200, {
        data: [
          makeEvent({
            id: 99,
            type: 'coderabbit_review_approved',
            repo_full_name: OTHER_REPO,
            pr_number: OTHER_PR,
            ts: NEWEST_TS,
          }),
        ],
        total: 100,
        page: 2,
        pageSize: PAGE_SIZE,
      });
      fireEvent.click(screen.getByText('Show earlier events'));
      await screen.findByText('Review approved');
      expect(screen.getByRole('button', { name: OTHER_REPO })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: `${OTHER_REPO}#${OTHER_PR}` })).toBeInTheDocument();
    });

    it('resets the filter when the timeline remounts', async () => {
      const { unmount } = renderEventHistory();
      await screen.findByText('showing 4 of 4');
      fireEvent.click(screen.getByRole('button', { name: MAIN_REPO }));
      expect(await screen.findByText('showing 3 of 4 loaded')).toBeInTheDocument();

      unmount();
      createMockFetch(200, FOUR_EVENTS_BODY);
      renderEventHistory();
      await screen.findByText('showing 4 of 4');
      expect(screen.getByRole('button', { name: MAIN_REPO })).toHaveAttribute('aria-pressed', 'false');
    });
  });

  describe('run id', () => {
    it('shows the run token on entries that carry one', async () => {
      createMockFetch(200, {
        data: [makeEvent({ id: 1, type: 'retriggered', run_id: RUN_ID })],
        total: 1,
        page: 1,
        pageSize: PAGE_SIZE,
      });
      renderEventHistory();

      await screen.findByText('Retrigger posted');
      expect(screen.getByText(`run=${RUN_ID}`)).toBeInTheDocument();
    });

    it('omits the run token when an entry has no run id', async () => {
      createMockFetch(200, {
        data: [makeEvent({ id: 1, type: 'retriggered' })],
        total: 1,
        page: 1,
        pageSize: PAGE_SIZE,
      });
      renderEventHistory();

      await screen.findByText('Retrigger posted');
      expect(screen.queryByText(/^run=/)).not.toBeInTheDocument();
    });

    it('refetches page 1 filtered by the typed run id', async () => {
      createMockFetch(200, { data: [makeEvent({ id: 1, type: 'retriggered' })], total: 2, page: 1, pageSize: PAGE_SIZE });
      renderEventHistory();
      await screen.findByText('Retrigger posted');

      createMockFetch(200, {
        data: [makeEvent({ id: 7, type: 'failed', run_id: RUN_ID })],
        total: 1,
        page: 1,
        pageSize: PAGE_SIZE,
      });
      fireEvent.change(screen.getByRole('searchbox', { name: 'Find a run' }), { target: { value: RUN_ID } });
      fireEvent.click(screen.getByRole('button', { name: 'Find' }));

      await screen.findByText('Failed');
      expect(globalThis.fetch).toHaveBeenCalledWith(`/api/events?page=1&pageSize=50&runId=${RUN_ID}`, undefined);
      expect(screen.getByText('showing 1 of 1')).toBeInTheDocument();
      expect(screen.queryByText('Retrigger posted')).not.toBeInTheDocument();
    });

    it('passes a pasted run= token through untouched', async () => {
      createMockFetch(200, { data: [makeEvent({ id: 1, type: 'retriggered' })], total: 2, page: 1, pageSize: PAGE_SIZE });
      renderEventHistory();
      await screen.findByText('Retrigger posted');

      createMockFetch(200, { data: [makeEvent({ id: 7, type: 'failed', run_id: RUN_ID })], total: 1, page: 1, pageSize: PAGE_SIZE });
      fireEvent.change(screen.getByRole('searchbox', { name: 'Find a run' }), { target: { value: `run=${RUN_ID}` } });
      fireEvent.click(screen.getByRole('button', { name: 'Find' }));

      await screen.findByText('Failed');
      expect(globalThis.fetch).toHaveBeenCalledWith(`/api/events?page=1&pageSize=50&runId=run%3D${RUN_ID}`, undefined);
    });

    it('keeps paging inside the run filter', async () => {
      createMockFetch(200, { data: [makeEvent({ id: 1, type: 'retriggered' })], total: 2, page: 1, pageSize: PAGE_SIZE });
      renderEventHistory();
      await screen.findByText('Retrigger posted');

      createMockFetch(200, { data: [makeEvent({ id: 7, type: 'failed', run_id: RUN_ID })], total: 3, page: 1, pageSize: PAGE_SIZE });
      fireEvent.change(screen.getByRole('searchbox', { name: 'Find a run' }), { target: { value: RUN_ID } });
      fireEvent.click(screen.getByRole('button', { name: 'Find' }));
      await screen.findByText('Failed');

      createMockFetch(200, { data: [makeEvent({ id: 8, type: 'dismissed', run_id: RUN_ID })], total: 3, page: 2, pageSize: PAGE_SIZE });
      fireEvent.click(screen.getByText('Show earlier events'));

      await screen.findByText('Dismissed');
      expect(globalThis.fetch).toHaveBeenCalledWith(`/api/events?page=2&pageSize=50&runId=${RUN_ID}`, undefined);
    });

    it('discards a page response that belongs to the previous run filter', async () => {
      const { resolve: resolvePending } = createDeferredFetch();
      const unfilteredUrl = '/api/events?page=1&pageSize=50';
      const runPage1Url = `/api/events?page=1&pageSize=50&runId=${RUN_ID}`;
      const runPage2Url = `/api/events?page=2&pageSize=50&runId=${RUN_ID}`;
      const otherRunPage1Url = `/api/events?page=1&pageSize=50&runId=${OTHER_RUN_ID}`;

      renderEventHistory();
      resolvePending(unfilteredUrl, { data: [makeEvent({ id: 1, type: 'enqueued' })], total: 2, page: 1, pageSize: PAGE_SIZE });
      await screen.findByText('Enqueued');

      fireEvent.change(screen.getByRole('searchbox', { name: 'Find a run' }), { target: { value: RUN_ID } });
      fireEvent.click(screen.getByRole('button', { name: 'Find' }));
      resolvePending(runPage1Url, { data: [makeEvent({ id: 2, type: 'retriggered', run_id: RUN_ID })], total: 3, page: 1, pageSize: PAGE_SIZE });
      await screen.findByText('Retrigger posted');

      fireEvent.click(screen.getByText('Show earlier events'));

      fireEvent.change(screen.getByRole('searchbox', { name: 'Find a run' }), { target: { value: OTHER_RUN_ID } });
      fireEvent.click(screen.getByRole('button', { name: 'Find' }));
      expect(screen.queryByText('Retrigger posted')).not.toBeInTheDocument();
      expect(screen.getByText('Loading events…')).toBeInTheDocument();

      resolvePending(otherRunPage1Url, { data: [makeEvent({ id: 3, type: 'failed', run_id: OTHER_RUN_ID })], total: 3, page: 1, pageSize: PAGE_SIZE });
      await screen.findByText('Failed');

      await act(async () => {
        resolvePending(runPage2Url, {
          data: [makeEvent({ id: 4, type: 'dismissed', run_id: RUN_ID })],
          total: 9,
          page: 2,
          pageSize: PAGE_SIZE,
        });
        await drainMicrotasks(STALE_RESPONSE_DRAIN);
      });

      expect(screen.queryByText('Dismissed')).not.toBeInTheDocument();
      expect(screen.getByText('showing 1 of 3')).toBeInTheDocument();

      fireEvent.click(screen.getByText('Show earlier events'));
      expect(globalThis.fetch).toHaveBeenCalledWith(`/api/events?page=2&pageSize=50&runId=${OTHER_RUN_ID}`, undefined);
    });

    it('discards a failed request that belongs to the previous run filter', async () => {
      const { reject, resolve } = createDeferredFetch();
      const unfilteredUrl = '/api/events?page=1&pageSize=50';
      const runPage1Url = `/api/events?page=1&pageSize=50&runId=${RUN_ID}`;
      const otherRunPage1Url = `/api/events?page=1&pageSize=50&runId=${OTHER_RUN_ID}`;

      renderEventHistory();
      resolve(unfilteredUrl, { data: [makeEvent({ id: 1, type: 'enqueued' })], total: 3, page: 1, pageSize: PAGE_SIZE });
      await screen.findByText('Enqueued');

      fireEvent.change(screen.getByRole('searchbox', { name: 'Find a run' }), { target: { value: RUN_ID } });
      fireEvent.click(screen.getByRole('button', { name: 'Find' }));
      fireEvent.change(screen.getByRole('searchbox', { name: 'Find a run' }), { target: { value: OTHER_RUN_ID } });
      fireEvent.click(screen.getByRole('button', { name: 'Find' }));

      resolve(otherRunPage1Url, { data: [makeEvent({ id: 3, type: 'failed', run_id: OTHER_RUN_ID })], total: 5, page: 1, pageSize: PAGE_SIZE });
      await screen.findByText('Failed');

      await act(async () => {
        reject(runPage1Url, new Error('Superseded request failed'));
        await drainMicrotasks(STALE_RESPONSE_DRAIN);
      });

      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      expect(screen.getByText('Failed')).toBeInTheDocument();
      expect(screen.queryByText('Retrigger posted')).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Show earlier events' })).toBeInTheDocument();
    });

    it('keeps the filter bar and names the run when it matches nothing', async () => {
      createMockFetch(200, { data: [makeEvent({ id: 1, type: 'retriggered' })], total: 2, page: 1, pageSize: PAGE_SIZE });
      renderEventHistory();
      await screen.findByText('Retrigger posted');

      createMockFetch(200, { data: [], total: 0, page: 1, pageSize: PAGE_SIZE });
      fireEvent.change(screen.getByRole('searchbox', { name: 'Find a run' }), { target: { value: RUN_ID } });
      fireEvent.click(screen.getByRole('button', { name: 'Find' }));

      await screen.findByText(`No events for run ${RUN_ID}`);
      expect(screen.getByRole('searchbox', { name: 'Find a run' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Clear' })).toBeInTheDocument();
    });

    it('restores the unfiltered timeline when the filter is cleared', async () => {
      createMockFetch(200, { data: [makeEvent({ id: 1, type: 'retriggered' })], total: 2, page: 1, pageSize: PAGE_SIZE });
      renderEventHistory();
      await screen.findByText('Retrigger posted');

      createMockFetch(200, { data: [makeEvent({ id: 7, type: 'failed', run_id: RUN_ID })], total: 1, page: 1, pageSize: PAGE_SIZE });
      fireEvent.change(screen.getByRole('searchbox', { name: 'Find a run' }), { target: { value: RUN_ID } });
      fireEvent.click(screen.getByRole('button', { name: 'Find' }));
      await screen.findByText('Failed');

      createMockFetch(200, { data: [makeEvent({ id: 9, type: 'enqueued' })], total: 2, page: 1, pageSize: PAGE_SIZE });
      fireEvent.click(screen.getByRole('button', { name: 'Clear' }));

      await screen.findByText('Enqueued');
      expect(globalThis.fetch).toHaveBeenCalledWith('/api/events?page=1&pageSize=50', undefined);
      expect(screen.queryByRole('button', { name: 'Clear' })).not.toBeInTheDocument();
    });

    it('clears the filter when Find is pressed on an emptied input', async () => {
      createMockFetch(200, { data: [makeEvent({ id: 1, type: 'retriggered' })], total: 2, page: 1, pageSize: PAGE_SIZE });
      renderEventHistory();
      await screen.findByText('Retrigger posted');

      createMockFetch(200, { data: [makeEvent({ id: 7, type: 'failed', run_id: RUN_ID })], total: 1, page: 1, pageSize: PAGE_SIZE });
      const search = screen.getByRole('searchbox', { name: 'Find a run' });
      fireEvent.change(search, { target: { value: RUN_ID } });
      fireEvent.click(screen.getByRole('button', { name: 'Find' }));
      await screen.findByText('Failed');

      createMockFetch(200, { data: [makeEvent({ id: 9, type: 'enqueued' })], total: 2, page: 1, pageSize: PAGE_SIZE });
      fireEvent.change(search, { target: { value: '   ' } });
      fireEvent.click(screen.getByRole('button', { name: 'Find' }));

      await screen.findByText('Enqueued');
      expect(globalThis.fetch).toHaveBeenCalledWith('/api/events?page=1&pageSize=50', undefined);
    });

    it('shows the server rejection when the typed run id is not a UUID', async () => {
      createMockFetch(200, { data: [makeEvent({ id: 1, type: 'retriggered' })], total: 2, page: 1, pageSize: PAGE_SIZE });
      renderEventHistory();
      await screen.findByText('Retrigger posted');

      createMockFetch(400, { error: 'runId must be a valid UUID v4' });
      fireEvent.change(screen.getByRole('searchbox', { name: 'Find a run' }), { target: { value: 'not-a-uuid' } });
      fireEvent.click(screen.getByRole('button', { name: 'Find' }));

      await screen.findByText('Event history: runId must be a valid UUID v4');
    });
  });

  describe('cleanup', () => {
    it('cancels in-flight fetch on unmount', () => {
      const fetchSpy = jest.spyOn(globalThis, 'fetch');
      const { unmount } = renderEventHistory();
      unmount();
      expect(fetchSpy).toHaveBeenCalled();
      fetchSpy.mockRestore();
    });
  });

  describe('error', () => {
    it('shows error message on HTTP failure', async () => {
      createMockFetch(500, { error: 'Internal server error' });
      renderEventHistory();
      await screen.findByText('Event history: Internal server error');
    });
  });

  describe('timezone', () => {
    it('formats timestamps in the selected timezone', async () => {
      localStorage.setItem('rm-timezone', 'America/New_York');
      createMockFetch(200, {
        data: [makeEvent({ id: 1, type: 'detected', ts: NEWEST_TS })],
        total: 1,
        page: 1,
        pageSize: PAGE_SIZE,
      });
      renderEventHistory();
      await screen.findByText('10:30:00');
      expect(screen.queryByText(tsDay(NEWEST_TS))).not.toBeInTheDocument();
    });
  });
});
