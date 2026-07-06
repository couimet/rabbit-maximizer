/** @jest-environment jsdom */

import SummaryStats from '../../dashboard/src/components/SummaryStats.js';
import { TimezoneProvider } from '../../dashboard/src/timezone.js';

import '@testing-library/jest-dom/jest-globals';
import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactElement } from 'react';

const renderSummaryStats = (ui?: ReactElement) => render(<TimezoneProvider>{ui ?? <SummaryStats />}</TimezoneProvider>);

const EMPTY_QUEUE_ORDER = { data: [] };

const mockSummaryFetch = (summaryData: unknown, queueOrderData: unknown = EMPTY_QUEUE_ORDER, stateData: unknown = null) => {
  globalThis.fetch = jest.fn((url: string) => {
    const urlStr = url as string;
    if (urlStr.includes('/api/state/next_review_available_at')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ next_review_available_at: stateData }),
      } as Response);
    }
    if (urlStr.includes('/api/queue/order')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(queueOrderData),
      } as Response);
    }
    return Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve(summaryData),
    } as Response);
  }) as unknown as typeof fetch;
};

describe('SummaryStats', () => {
  afterEach(() => {
    (globalThis.fetch as jest.Mock).mockRestore?.();
    localStorage.clear();
  });

  describe('loading', () => {
    it('shows loading text while fetch is in-flight', () => {
      globalThis.fetch = jest.fn(() => new Promise(() => {})) as unknown as typeof fetch;
      renderSummaryStats();
      expect(screen.getByText('Loading summary…')).toBeInTheDocument();
    });
  });

  describe('data', () => {
    const summaryData = {
      queueCounts: { pending: 5, retriggered: 12, failed: 2 },
      eventCounts: { detected: 8, enqueued: 7, retriggered: 3, failed: 1 },
      oldestPending: null,
    };

    beforeEach(() => {
      mockSummaryFetch(summaryData, { data: [] });
    });

    it('renders queue count section with correct values', async () => {
      renderSummaryStats();
      await waitFor(() => expect(screen.getByText('Queue Counts')).toBeInTheDocument());
      for (const [, count] of Object.entries(summaryData.queueCounts)) {
        expect(screen.getByText(String(count))).toBeInTheDocument();
      }
    });

    it('renders event counts from last 24h', async () => {
      renderSummaryStats();
      await waitFor(() => expect(screen.getByText(String(summaryData.eventCounts.detected))).toBeInTheDocument());
      expect(screen.getByText('detected')).toBeInTheDocument();
      expect(screen.getByText(String(summaryData.eventCounts.enqueued))).toBeInTheDocument();
      expect(screen.getByText('enqueued')).toBeInTheDocument();
    });

    it('changes duration and re-fetches summary', async () => {
      renderSummaryStats();
      await waitFor(() => expect(screen.getByText('Queue Counts')).toBeInTheDocument());

      const newSummary = {
        queueCounts: { pending: 1, retriggered: 0, failed: 0 },
        eventCounts: { detected: 5, enqueued: 3, retriggered: 2, failed: 0 },
        oldestPending: null,
      };
      const fetchCalls: string[] = [];
      globalThis.fetch = jest.fn((url: string) => {
        fetchCalls.push(url as string);
        const urlStr = url as string;
        if (urlStr.includes('/api/state/next_review_available_at')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve({ next_review_available_at: null }),
          } as Response);
        }
        if (urlStr.includes('/api/queue/order')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve(EMPTY_QUEUE_ORDER),
          } as Response);
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve(newSummary),
        } as Response);
      }) as unknown as typeof fetch;

      fireEvent.change(screen.getByRole('combobox'), { target: { value: '2d' } });
      await waitFor(() => expect(screen.getByText('5')).toBeInTheDocument());
    });

    it('renders the QueueOrder component on the Summary tab', async () => {
      renderSummaryStats();
      await waitFor(() => expect(screen.getByText('Queue Order')).toBeInTheDocument());
    });
  });

  describe('review countdown', () => {
    const summaryData = {
      queueCounts: { pending: 5, retriggered: 12, failed: 2 },
      eventCounts: { detected: 8, enqueued: 7, retriggered: 3, failed: 1 },
      oldestPending: null,
    };

    it('renders Available now when next_review_available_at is null', async () => {
      mockSummaryFetch(summaryData, { data: [] }, null);
      renderSummaryStats();
      await waitFor(() => expect(screen.getByText('Available now')).toBeInTheDocument());
    });

    it('renders Available now when next_review_available_at is in the past', async () => {
      mockSummaryFetch(summaryData, { data: [] }, new Date(Date.now() - 60_000).toISOString());
      renderSummaryStats();
      await waitFor(() => expect(screen.getByText('Available now')).toBeInTheDocument());
    });

    it('renders countdown text when next_review_available_at is in the future', async () => {
      mockSummaryFetch(summaryData, { data: [] }, new Date(Date.now() + 120_000).toISOString());
      renderSummaryStats();
      await waitFor(() => expect(screen.getByText('Next review available in')).toBeInTheDocument());
    });
  });

  describe('cleanup', () => {
    it('cancels in-flight fetch on unmount', () => {
      const { unmount } = renderSummaryStats();
      unmount();
      expect(globalThis.fetch).toHaveBeenCalled();
    });
  });

  describe('error', () => {
    it('shows error message on HTTP failure', async () => {
      globalThis.fetch = jest.fn(() =>
        Promise.resolve({ ok: false, status: 500, json: () => Promise.resolve({ error: 'Internal server error' }) } as Response),
      ) as unknown as typeof fetch;
      renderSummaryStats();
      await waitFor(() => expect(screen.getByText('Failed to load summary: Internal server error')).toBeInTheDocument());
    });

    it('shows generic error message when fetch rejects', async () => {
      globalThis.fetch = jest.fn(() => Promise.reject(new Error('Network error'))) as unknown as typeof fetch;
      renderSummaryStats();
      await waitFor(() => expect(screen.getByText('Failed to load summary: Network error')).toBeInTheDocument());
    });
  });
});
