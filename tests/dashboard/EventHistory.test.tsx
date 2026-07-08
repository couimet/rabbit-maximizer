/** @jest-environment jsdom */

import EventHistory from '../../dashboard/src/components/EventHistory.js';
import { TimezoneProvider } from '../../dashboard/src/timezone.js';
import { formatDate } from '../../src/utils/formatDate.js';
import { createMockFetch, makeUniqueRepoName } from '../helpers/index.js';

import '@testing-library/jest-dom/jest-globals';
import { getUniqueDate, getUniqueInt, getUniqueString } from '@couimet/dynamic-testing';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react';

const renderEventHistory = () =>
  render(
    <TimezoneProvider>
      <EventHistory />
    </TimezoneProvider>,
  );

const PAGE_SIZE = 50;
const MAIN_REPO = 'couimet/rabbit-maximizer';
const OTHER_REPO = 'couimet/other';
const MAIN_PR = getUniqueInt();
const OTHER_PR = getUniqueInt();
const TOTAL_EVENTS = 4;
const CORR_001 = 'corr-001';
const CORR_002 = 'corr-002';
const MS_PER_MINUTE = 60_000;
const TS_TO_TS2_OFFSET_MINUTES = 90;
const TS_1 = getUniqueDate();
const TS_1_ISO = TS_1.toISOString();
const TS_1_DISPLAY = formatDate(TS_1_ISO, 'UTC');
const TS_2 = new Date(TS_1.getTime() + TS_TO_TS2_OFFSET_MINUTES * MS_PER_MINUTE);
const TS_2_ISO = TS_2.toISOString();
const TS_2_DISPLAY = formatDate(TS_2_ISO, 'UTC');

const makeEvent = (over: Record<string, unknown> = {}) => ({
  id: getUniqueInt(),
  uuid: getUniqueString({ prefix: 'evt-' }),
  ts: getUniqueDate().toISOString(),
  type: 'detected',
  repo_full_name: makeUniqueRepoName().fullName,
  pr_number: getUniqueInt(),
  correlation_id: getUniqueString({ prefix: 'corr-' }),
  request_id: getUniqueString({ prefix: 'req-' }),
  version: '1.0.0',
  metadata: {},
  payload: {},
  ...over,
});

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
      createMockFetch(200, {
        data: [
          makeEvent({
            id: 1,
            type: 'detected',
            correlation_id: CORR_001,
            repo_full_name: MAIN_REPO,
            pr_number: MAIN_PR,
            ts: TS_1_ISO,
          }),
          makeEvent({
            id: 2,
            type: 'enqueued',
            correlation_id: CORR_001,
            repo_full_name: MAIN_REPO,
            pr_number: MAIN_PR,
            ts: new Date(TS_1.getTime() + 5 * MS_PER_MINUTE).toISOString(),
          }),
          makeEvent({
            id: 3,
            type: 'retriggered',
            correlation_id: CORR_001,
            repo_full_name: MAIN_REPO,
            pr_number: MAIN_PR,
            ts: new Date(TS_1.getTime() + 10 * MS_PER_MINUTE).toISOString(),
          }),
          makeEvent({
            id: 4,
            type: 'failed',
            correlation_id: CORR_002,
            repo_full_name: OTHER_REPO,
            pr_number: OTHER_PR,
            ts: TS_2_ISO,
          }),
        ],
        total: TOTAL_EVENTS,
        page: 1,
        pageSize: PAGE_SIZE,
      });
    });

    it('renders repo links for each PR group header row', async () => {
      renderEventHistory();
      await screen.findByText(MAIN_REPO);
      expect(screen.getByText(OTHER_REPO)).toBeInTheDocument();
    });

    it('renders event types as badges within rows', async () => {
      renderEventHistory();
      await screen.findAllByText(TS_1_DISPLAY);
      expect(screen.getByText('detected')).toBeInTheDocument();
      expect(screen.getByText('enqueued')).toBeInTheDocument();
      expect(screen.getByText('retriggered')).toBeInTheDocument();
      expect(screen.getAllByText('failed')).toHaveLength(1);
    });

    it('renders absolute timestamps in the When column', async () => {
      renderEventHistory();
      await screen.findAllByText(TS_1_DISPLAY);
      expect(screen.getAllByText(TS_2_DISPLAY)).toHaveLength(1);
    });

    it('renders repo and PR links opening in new tabs', async () => {
      renderEventHistory();
      await screen.findByText(MAIN_REPO);

      const repoLink = screen.getByText(MAIN_REPO).closest('a');
      expect(repoLink).toHaveAttribute('href', `https://github.com/${MAIN_REPO}`);
      expect(repoLink).toHaveAttribute('target', '_blank');

      const prLink = screen.getByText(`#${MAIN_PR}`).closest('a');
      expect(prLink).toHaveAttribute('href', `https://github.com/${MAIN_REPO}/pull/${MAIN_PR}`);
      expect(prLink).toHaveAttribute('target', '_blank');
    });

    it('shows payload JSON in Detail column when payload is non-empty', async () => {
      createMockFetch(200, {
        data: [makeEvent({ id: 10, type: 'detected', payload: { reason: 'rate limited' } })],
        total: 1,
        page: 1,
        pageSize: PAGE_SIZE,
      });
      renderEventHistory();
      await screen.findByText('{"reason":"rate limited"}');
    });

    it('falls back to correlation_id when payload is null', async () => {
      createMockFetch(200, {
        data: [makeEvent({ id: 11, type: 'detected', correlation_id: 'fallback-99', payload: null as unknown as Record<string, unknown> })],
        total: 1,
        page: 1,
        pageSize: PAGE_SIZE,
      });
      renderEventHistory();
      await screen.findByText('fallback-99');
    });

    it('shows correlation IDs in the Detail column', async () => {
      renderEventHistory();
      await screen.findByText(CORR_002);
      expect(screen.getAllByText(CORR_001)).toHaveLength(3);
    });
  });

  describe('empty', () => {
    it('shows empty message when no events exist', async () => {
      createMockFetch(200, { data: [], total: 0, page: 1, pageSize: PAGE_SIZE });
      renderEventHistory();
      await screen.findByText('No events.');
    });
  });

  describe('pagination', () => {
    it('disables Previous on first page', async () => {
      createMockFetch(200, { data: [makeEvent({ type: 'detected' })], total: 1, page: 1, pageSize: PAGE_SIZE });
      renderEventHistory();
      await screen.findByText('detected');
      expect(screen.getByText('Previous').closest('button')).toBeDisabled();
    });

    it('fetches next page when Next is clicked', async () => {
      createMockFetch(200, { data: [makeEvent({ type: 'detected' })], total: 100, page: 1, pageSize: PAGE_SIZE });
      renderEventHistory();
      await screen.findByText('detected');

      createMockFetch(200, { data: [makeEvent({ id: 99, type: 'completed' })], total: 100, page: 2, pageSize: PAGE_SIZE });
      fireEvent.click(screen.getByText('Next'));
      await screen.findByText('completed');
    });

    it('fetches previous page when Previous is clicked', async () => {
      createMockFetch(200, { data: [makeEvent({ type: 'detected' })], total: 100, page: 1, pageSize: PAGE_SIZE });
      renderEventHistory();
      await screen.findByText('detected');

      createMockFetch(200, { data: [makeEvent({ id: 99, type: 'completed' })], total: 100, page: 2, pageSize: PAGE_SIZE });
      fireEvent.click(screen.getByText('Next'));
      await screen.findByText('completed');

      createMockFetch(200, { data: [makeEvent({ id: 88, type: 'retriggered' })], total: 100, page: 1, pageSize: PAGE_SIZE });
      fireEvent.click(screen.getByText('Previous'));
      await screen.findByText('retriggered');
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
      await screen.findByText('Failed to load events: Internal server error');
    });
  });

  describe('timezone', () => {
    beforeEach(() => {
      localStorage.setItem('rm-timezone', 'America/New_York');
      createMockFetch(200, {
        data: [makeEvent({ id: 1, type: 'detected', ts: '2026-06-23T14:30:00.000Z' })],
        total: 1,
        page: 1,
        pageSize: PAGE_SIZE,
      });
    });

    it('renders When column header without timezone suffix for non-UTC', async () => {
      renderEventHistory();
      await screen.findByText('When');
    });

    it('formats timestamps in the selected timezone', async () => {
      renderEventHistory();
      await screen.findAllByText('2026-06-23 10:30:00');
    });
  });
});
