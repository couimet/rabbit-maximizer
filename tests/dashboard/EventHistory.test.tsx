/** @jest-environment jsdom */

import EventHistory from '../../dashboard/src/components/EventHistory.js';
import { createMockFetch } from '../helpers/index.js';
import { TimezoneProvider } from '../../dashboard/src/timezone.js';

import '@testing-library/jest-dom/jest-globals';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

const renderEventHistory = () =>
  render(
    <TimezoneProvider>
      <EventHistory />
    </TimezoneProvider>,
  );

const PAGE_SIZE = 20;

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
          makeEvent({ id: 3, type: 'posted', correlation_id: 'corr-001', ts: '2026-06-23T10:10:00.000Z' }),
          makeEvent({ id: 4, type: 'failed', correlation_id: 'corr-002', repo_full_name: 'couimet/other', pr_number: 7, ts: '2026-06-23T11:30:00.000Z' }),
        ],
        total: 4,
        page: 1,
        pageSize: PAGE_SIZE,
      });
    });

    it('groups events by repo and PR', async () => {
      renderEventHistory();
      await waitFor(() => expect(screen.getByText('couimet/rabbit-maximizer')).toBeInTheDocument());
      expect(screen.getByText('couimet/other')).toBeInTheDocument();
    });

    it('renders event types and timestamps within each group', async () => {
      renderEventHistory();
      await waitFor(() => expect(screen.getByText('detected')).toBeInTheDocument());
      expect(screen.getByText('enqueued')).toBeInTheDocument();
      expect(screen.getByText('posted')).toBeInTheDocument();
      expect(screen.getByText('failed')).toBeInTheDocument();
      expect(screen.getByText('2026-06-23 10:00:00')).toBeInTheDocument();
      expect(screen.getByText('2026-06-23 11:30:00')).toBeInTheDocument();
    });

    it('renders repo and PR links opening in new tabs', async () => {
      renderEventHistory();
      await waitFor(() => expect(screen.getByText('couimet/rabbit-maximizer')).toBeInTheDocument());

      const repoLink = screen.getByText('couimet/rabbit-maximizer').closest('a');
      expect(repoLink).toHaveAttribute('href', 'https://github.com/couimet/rabbit-maximizer');
      expect(repoLink).toHaveAttribute('target', '_blank');

      const prLink = screen.getByText('#42').closest('a');
      expect(prLink).toHaveAttribute('href', 'https://github.com/couimet/rabbit-maximizer/pull/42');
      expect(prLink).toHaveAttribute('target', '_blank');
    });

    it('shows correlation IDs for each event', async () => {
      renderEventHistory();
      await waitFor(() => expect(screen.getByText('corr-002')).toBeInTheDocument());
      expect(screen.getAllByText('corr-001')).toHaveLength(3);
    });
  });

  describe('empty', () => {
    it('shows empty message when no events exist', async () => {
      createMockFetch(200, { data: [], total: 0, page: 1, pageSize: PAGE_SIZE });
      renderEventHistory();
      await waitFor(() => expect(screen.getByText('No events.')).toBeInTheDocument());
    });
  });

  describe('pagination', () => {
    it('disables Previous on first page', async () => {
      createMockFetch(200, { data: [makeEvent()], total: 1, page: 1, pageSize: PAGE_SIZE });
      renderEventHistory();
      await waitFor(() => expect(screen.getByText('detected')).toBeInTheDocument());
      expect(screen.getByText('Previous').closest('button')).toBeDisabled();
    });

    it('fetches next page when Next is clicked', async () => {
      createMockFetch(200, { data: [makeEvent({ type: 'detected' })], total: 50, page: 1, pageSize: PAGE_SIZE });
      renderEventHistory();
      await waitFor(() => expect(screen.getByText('detected')).toBeInTheDocument());

      createMockFetch(200, { data: [makeEvent({ id: 99, type: 'completed' })], total: 50, page: 2, pageSize: PAGE_SIZE });
      fireEvent.click(screen.getByText('Next'));
      await waitFor(() => expect(screen.getByText('completed')).toBeInTheDocument());
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
      await waitFor(() => expect(screen.getByText('Failed to load events: Internal server error')).toBeInTheDocument());
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

    it('renders column header without timezone suffix for non-UTC', async () => {
      renderEventHistory();
      await waitFor(() => expect(screen.getByText('Time')).toBeInTheDocument());
    });

    it('formats dates in the selected timezone', async () => {
      renderEventHistory();
      await waitFor(() => expect(screen.getByText('2026-06-23 10:30:00')).toBeInTheDocument());
    });
  });
});
