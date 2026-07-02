/** @jest-environment jsdom */

import SummaryStats from '../../dashboard/src/components/SummaryStats.js';
import { TimezoneProvider } from '../../dashboard/src/timezone.js';

import '@testing-library/jest-dom/jest-globals';
import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { render, screen, waitFor } from '@testing-library/react';
import type { ReactElement } from 'react';

const renderSummaryStats = (ui?: ReactElement) => render(<TimezoneProvider>{ui ?? <SummaryStats />}</TimezoneProvider>);

const EMPTY_QUEUE_ORDER = { data: [] };

const mockSummaryFetch = (summaryData: unknown, queueOrderData: unknown = EMPTY_QUEUE_ORDER) => {
  globalThis.fetch = jest.fn((url: string) => {
    const data = (url as string).includes('/api/queue/order') ? queueOrderData : summaryData;
    return Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve(data),
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
      queueCounts: { pending: 5, posted: 12, completed: 10, failed: 2 },
      eventCounts24h: { detected: 8, enqueued: 7, posted: 3, rejected: 1, completed: 14, failed: 1 },
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
      await waitFor(() => expect(screen.getByText(String(summaryData.eventCounts24h.detected))).toBeInTheDocument());
      expect(screen.getByText('detected')).toBeInTheDocument();
      expect(screen.getByText(String(summaryData.eventCounts24h.enqueued))).toBeInTheDocument();
      expect(screen.getByText('enqueued')).toBeInTheDocument();
    });

    it('renders the QueueOrder component on the Summary tab', async () => {
      renderSummaryStats();
      await waitFor(() => expect(screen.getByText('Queue Order')).toBeInTheDocument());
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
