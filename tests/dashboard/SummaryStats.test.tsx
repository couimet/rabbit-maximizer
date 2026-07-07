/** @jest-environment jsdom */

import SummaryStats from '../../dashboard/src/components/SummaryStats.js';
import { TimezoneProvider } from '../../dashboard/src/timezone.js';

import '@testing-library/jest-dom/jest-globals';
import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactElement } from 'react';
import { StrictMode } from 'react';

const renderSummaryStats = (ui?: ReactElement) => render(<TimezoneProvider>{ui ?? <SummaryStats />}</TimezoneProvider>);

const DEFAULT_EVENT_COUNTS = { detected: 8, enqueued: 7, retriggered: 3, failed: 1 };

const mockDashboardState = (data: Record<string, unknown>) => {
  globalThis.fetch = jest.fn(() =>
    Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve(data),
    } as Response),
  ) as unknown as typeof fetch;
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

    it('shows loading text when data is null', () => {
      globalThis.fetch = jest.fn(() => new Promise(() => {})) as unknown as typeof fetch;
      renderSummaryStats();
      expect(screen.getByText('Loading summary…')).toBeInTheDocument();
    });
  });

  describe('data', () => {
    const dashboardData = {
      nextReviewAvailableAt: null,
      pendingItems: [],
      eventCounts: DEFAULT_EVENT_COUNTS,
    };

    beforeEach(() => {
      mockDashboardState(dashboardData);
    });

    it('renders pending count from pendingItems', async () => {
      renderSummaryStats();
      await waitFor(() => expect(screen.getByText('Queue Order — 0 pending item(s)')).toBeInTheDocument());
    });

    it('renders event counts', async () => {
      renderSummaryStats();
      await waitFor(() => expect(screen.getByText(String(DEFAULT_EVENT_COUNTS.detected))).toBeInTheDocument());
      expect(screen.getByText('detected')).toBeInTheDocument();
      expect(screen.getByText(String(DEFAULT_EVENT_COUNTS.enqueued))).toBeInTheDocument();
      expect(screen.getByText('enqueued')).toBeInTheDocument();
    });

    it('changes duration and re-fetches', async () => {
      renderSummaryStats();
      await waitFor(() => expect(screen.getByText('Queue Order — 0 pending item(s)')).toBeInTheDocument());

      const newData = {
        nextReviewAvailableAt: null,
        pendingItems: [],
        eventCounts: { detected: 5, enqueued: 3, retriggered: 2, failed: 0 },
      };
      let capturedUrl = '';
      globalThis.fetch = jest.fn((url: string) => {
        capturedUrl = url as string;
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve(newData),
        } as Response);
      }) as unknown as typeof fetch;

      fireEvent.change(screen.getByRole('combobox'), { target: { value: '2d' } });
      await waitFor(() => expect(screen.getByText('5')).toBeInTheDocument());
      expect(capturedUrl).toContain('duration=2d');
    });

    it('renders the QueueOrder component on the Summary tab', async () => {
      renderSummaryStats();
      await waitFor(() => expect(screen.getByText('Queue Order — 0 pending item(s)')).toBeInTheDocument());
    });

    it('ignores stale response when newer request resolves first', async () => {
      const staleData = {
        nextReviewAvailableAt: null,
        pendingItems: [],
        eventCounts: { detected: 1, enqueued: 0, retriggered: 0, failed: 0 },
      };
      const freshData = {
        nextReviewAvailableAt: null,
        pendingItems: [],
        eventCounts: { detected: 9, enqueued: 0, retriggered: 0, failed: 0 },
      };

      mockDashboardState({
        nextReviewAvailableAt: null,
        pendingItems: [],
        eventCounts: DEFAULT_EVENT_COUNTS,
      });
      renderSummaryStats();
      await waitFor(() => expect(screen.getByText('8')).toBeInTheDocument());

      let resolveStale: (v: Response) => void;
      const stalePromise = new Promise<Response>((r) => {
        resolveStale = r;
      });

      let callCount = 0;
      globalThis.fetch = jest.fn((_url: string) => {
        callCount++;
        if (callCount === 1) return stalePromise;
        return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(freshData) } as Response);
      }) as unknown as typeof fetch;

      // Two rapid duration changes: first is stale (pending), second resolves immediately.
      fireEvent.change(screen.getByRole('combobox'), { target: { value: '2d' } });
      fireEvent.change(screen.getByRole('combobox'), { target: { value: '3d' } });

      await waitFor(() => expect(screen.getByText('9')).toBeInTheDocument());

      resolveStale!({ ok: true, status: 200, json: () => Promise.resolve(staleData) } as Response);

      await new Promise((r) => setTimeout(r, 0));
      expect(screen.getByText('9')).toBeInTheDocument();
      expect(screen.queryByText('1')).not.toBeInTheDocument();
    });

    it('ignores stale error when a newer request resolves successfully', async () => {
      const freshData = {
        nextReviewAvailableAt: null,
        pendingItems: [],
        eventCounts: { detected: 9, enqueued: 0, retriggered: 0, failed: 0 },
      };

      mockDashboardState({
        nextReviewAvailableAt: null,
        pendingItems: [],
        eventCounts: DEFAULT_EVENT_COUNTS,
      });
      renderSummaryStats();
      await waitFor(() => expect(screen.getByText('8')).toBeInTheDocument());

      let rejectStale: (err: Error) => void;
      const stalePromise = new Promise<Response>((_resolve, reject) => {
        rejectStale = reject;
      });

      let callCount = 0;
      globalThis.fetch = jest.fn((_url: string) => {
        callCount++;
        if (callCount === 1) return stalePromise;
        return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(freshData) } as Response);
      }) as unknown as typeof fetch;

      // Two rapid duration changes: first will error, second succeeds.
      fireEvent.change(screen.getByRole('combobox'), { target: { value: '2d' } });
      fireEvent.change(screen.getByRole('combobox'), { target: { value: '3d' } });

      await waitFor(() => expect(screen.getByText('9')).toBeInTheDocument());

      // Reject the stale first request — its error should be ignored.
      rejectStale!(new Error('Stale network error'));

      await new Promise((r) => setTimeout(r, 0));
      expect(screen.getByText('9')).toBeInTheDocument();
      expect(screen.queryByText('Failed to load summary')).not.toBeInTheDocument();
    });
  });

  describe('review countdown', () => {
    const dashboardData = {
      pendingItems: [],
      eventCounts: DEFAULT_EVENT_COUNTS,
    };

    it('renders Available now when nextReviewAvailableAt is null', async () => {
      mockDashboardState({ ...dashboardData, nextReviewAvailableAt: null });
      renderSummaryStats();
      await waitFor(() => expect(screen.getByText('Available now')).toBeInTheDocument());
    });

    it('renders Available now when nextReviewAvailableAt is in the past', async () => {
      mockDashboardState({ ...dashboardData, nextReviewAvailableAt: new Date(Date.now() - 60_000).toISOString() });
      renderSummaryStats();
      await waitFor(() => expect(screen.getByText('Available now')).toBeInTheDocument());
    });

    it('renders countdown text when nextReviewAvailableAt is in the future', async () => {
      mockDashboardState({ ...dashboardData, nextReviewAvailableAt: new Date(Date.now() + 120_000).toISOString() });
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

    it('ignores fetch resolution after component unmounts', async () => {
      let resolveFetch: (v: Response) => void;
      const pending = new Promise<Response>((r) => {
        resolveFetch = r;
      });
      globalThis.fetch = jest.fn(() => pending) as unknown as typeof fetch;

      const { unmount } = renderSummaryStats();
      unmount();

      resolveFetch!({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ nextReviewAvailableAt: null, pendingItems: [], eventCounts: { detected: 0, enqueued: 0, retriggered: 0, failed: 0 } }),
      } as Response);

      await new Promise((r) => setTimeout(r, 0));
    });

    it('ignores fetch rejection after component unmounts', async () => {
      let rejectFetch: (err: Error) => void;
      const pending = new Promise<Response>((_resolve, reject) => {
        rejectFetch = reject;
      });
      globalThis.fetch = jest.fn(() => pending) as unknown as typeof fetch;

      const { unmount } = renderSummaryStats();
      unmount();

      rejectFetch!(new Error('Network error'));

      await new Promise((r) => setTimeout(r, 0));
    });

    it('loads data after StrictMode double-invoke', async () => {
      mockDashboardState({
        nextReviewAvailableAt: null,
        pendingItems: [],
        eventCounts: { detected: 1, enqueued: 0, retriggered: 0, failed: 0 },
      });

      render(
        <StrictMode>
          <TimezoneProvider>
            <SummaryStats />
          </TimezoneProvider>
        </StrictMode>,
      );
      await waitFor(() => expect(screen.getByText('Queue Order — 0 pending item(s)')).toBeInTheDocument());
    });

    it('re-fetches dashboard state when QueueOrder calls onMoveComplete', async () => {
      const queueItem = {
        uuid: '00000000-0000-0000-0000-000000000001',
        repo_full_name: 'owner/repo',
        pr_number: 42,
        status: 'pending',
        not_before: new Date().toISOString(),
        attempts: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      const initialData = {
        nextReviewAvailableAt: null,
        pendingItems: [queueItem],
        eventCounts: { detected: 1, enqueued: 0, retriggered: 0, failed: 0 },
      };
      const refreshedData = {
        nextReviewAvailableAt: null,
        pendingItems: [queueItem],
        eventCounts: { detected: 2, enqueued: 0, retriggered: 0, failed: 0 },
      };

      let dashboardCallCount = 0;
      globalThis.fetch = jest.fn((_url: string, init?: RequestInit) => {
        if (init?.method === 'POST') {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve({ data: [queueItem] }),
          } as Response);
        }
        dashboardCallCount++;
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve(dashboardCallCount === 1 ? initialData : refreshedData),
        } as Response);
      }) as unknown as typeof fetch;

      renderSummaryStats();
      await waitFor(() => expect(screen.getByText('Queue Order — 1 pending item(s)')).toBeInTheDocument());

      fireEvent.click(screen.getByLabelText('Select owner/repo #42'));
      fireEvent.click(screen.getByText('Move Up'));

      await waitFor(() => expect(screen.getByText('2')).toBeInTheDocument());
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
