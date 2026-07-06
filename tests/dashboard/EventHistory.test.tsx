/** @jest-environment jsdom */

import EventHistory from '../../dashboard/src/components/EventHistory.js';
import { TimezoneProvider } from '../../dashboard/src/timezone.js';
import { createMockFetch } from '../helpers/index.js';

import '@testing-library/jest-dom/jest-globals';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react';

const renderEventHistory = () =>
  render(
    <TimezoneProvider>
      <EventHistory />
    </TimezoneProvider>,
  );

const PAGE_SIZE = 50;

const makeEvent = (over: Record<string, unknown> = {}) => ({
  id: 1,
  uuid: 'evt-abc',
  ts: '2026-06-23T14:30:00.000Z',
  type: 'detected',
  repo_full_name: 'couimet/rabbit-maximizer',
  pr_number: 42,
  correlation_id: 'corr-001',
  request_id: 'req-001',
  version: '1.0.0',
  metadata: {},
  payload: {},
  ...over,
});

describe('EventHistory', () => {
  afterEach(() => {
    (globalThis.fetch as jest.Mock).mockRestore?.();
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
          makeEvent({ id: 1, type: 'detected', correlation_id: 'corr-001', ts: '2026-06-23T10:00:00.000Z' }),
          makeEvent({ id: 2, type: 'enqueued', correlation_id: 'corr-001', ts: '2026-06-23T10:05:00.000Z' }),
          makeEvent({ id: 3, type: 'retriggered', correlation_id: 'corr-001', ts: '2026-06-23T10:10:00.000Z' }),
          makeEvent({ id: 4, type: 'failed', correlation_id: 'corr-002', repo_full_name: 'couimet/other', pr_number: 7, ts: '2026-06-23T11:30:00.000Z' }),
        ],
        total: 4,
        page: 1,
        pageSize: PAGE_SIZE,
      });
    });

    it('renders repo links for each PR group header row', async () => {
      renderEventHistory();
      await screen.findByText('couimet/rabbit-maximizer');
      expect(screen.getByText('couimet/other')).toBeInTheDocument();
    });

    it('renders event types as badges within rows', async () => {
      renderEventHistory();
      await screen.findAllByText('2026-06-23 10:00:00');
      expect(screen.getByText('detected')).toBeInTheDocument();
      expect(screen.getByText('enqueued')).toBeInTheDocument();
      expect(screen.getByText('retriggered')).toBeInTheDocument();
      expect(screen.getAllByText('failed')).toHaveLength(1);
    });

    it('renders absolute timestamps in the When column', async () => {
      renderEventHistory();
      await screen.findAllByText('2026-06-23 10:00:00');
      expect(screen.getAllByText('2026-06-23 11:30:00')).toHaveLength(1);
    });

    it('renders repo and PR links opening in new tabs', async () => {
      renderEventHistory();
      await screen.findByText('couimet/rabbit-maximizer');

      const repoLink = screen.getByText('couimet/rabbit-maximizer').closest('a');
      expect(repoLink).toHaveAttribute('href', 'https://github.com/couimet/rabbit-maximizer');
      expect(repoLink).toHaveAttribute('target', '_blank');

      const prLink = screen.getByText('#42').closest('a');
      expect(prLink).toHaveAttribute('href', 'https://github.com/couimet/rabbit-maximizer/pull/42');
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
      await screen.findByText('corr-002');
      expect(screen.getAllByText('corr-001')).toHaveLength(3);
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
      createMockFetch(200, { data: [makeEvent()], total: 1, page: 1, pageSize: PAGE_SIZE });
      renderEventHistory();
      await screen.findByText('corr-001');
      expect(screen.getByText('Previous').closest('button')).toBeDisabled();
    });

    it('fetches next page when Next is clicked', async () => {
      createMockFetch(200, { data: [makeEvent({ type: 'detected' })], total: 100, page: 1, pageSize: PAGE_SIZE });
      renderEventHistory();
      await screen.findByText('corr-001');

      createMockFetch(200, { data: [makeEvent({ id: 99, type: 'completed' })], total: 100, page: 2, pageSize: PAGE_SIZE });
      fireEvent.click(screen.getByText('Next'));
      await screen.findByText('corr-001');
    });

    it('fetches previous page when Previous is clicked from page 2', async () => {
      createMockFetch(200, { data: [makeEvent({ type: 'detected' })], total: 100, page: 2, pageSize: PAGE_SIZE });
      renderEventHistory();
      await screen.findByText('corr-001');

      createMockFetch(200, { data: [makeEvent({ id: 88, type: 'enqueued' })], total: 100, page: 1, pageSize: PAGE_SIZE });
      fireEvent.click(screen.getByText('Previous'));
      await screen.findByText('corr-001');
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
