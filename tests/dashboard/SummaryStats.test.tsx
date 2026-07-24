/** @jest-environment jsdom */

import { ErrorProvider, GlobalErrorBanner, SummaryStats, TimezoneProvider } from '../../dashboard/src/index.js';

import '@testing-library/jest-dom/jest-globals';
import { getUniqueDate, getUniqueGitHubRepoRef, getUniqueInt, getUuid } from '@couimet/dynamic-testing';
import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { type ReactElement, StrictMode } from 'react';

const renderSummaryStats = (ui?: ReactElement) =>
  render(
    <TimezoneProvider>
      <ErrorProvider>
        <GlobalErrorBanner />
        {ui ?? <SummaryStats />}
      </ErrorProvider>
    </TimezoneProvider>,
  );

const DEFAULT_EVENT_COUNTS = { detected: 8, enqueued: 7, retriggered: 3, failed: 1 };

const TRIGGERED_RESPONSE = { data: [], total: 0, page: 1, pageSize: 50 };

const DEFAULT_CONFIG_RESPONSE = { pauseNotificationInitialDelaySec: 1800, pauseNotificationRepeatIntervalSec: 900, schedulerStaleThresholdMs: 40000 };

const mockDashboardState = (data: Record<string, unknown>) => {
  globalThis.fetch = jest.fn((url: string) => {
    if (typeof url === 'string' && url.includes('/queue/triggered')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(TRIGGERED_RESPONSE),
      } as Response);
    }
    if (url === '/api/config') {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(DEFAULT_CONFIG_RESPONSE),
      } as Response);
    }
    return Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve(data),
    } as Response);
  }) as unknown as typeof fetch;
};

describe('SummaryStats', () => {
  beforeEach(() => {
    Object.defineProperty(globalThis, 'Notification', {
      writable: true,
      configurable: true,
      value: Object.assign(
        jest.fn(() => ({ close: jest.fn() })),
        {
          requestPermission: jest.fn(() => Promise.resolve('denied' as const)),
          permission: 'default',
        },
      ),
    });
  });

  afterEach(() => {
    localStorage.clear();
    globalThis.fetch = undefined as unknown as typeof fetch;
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
      lastSchedulerTickAt: null,
      nextReviewAvailableAt: null,
      pendingItems: [],
      eventCounts: DEFAULT_EVENT_COUNTS,
      paused: false,
      schedulerStale: false,
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
        paused: false,
      };
      let capturedUrl = '';
      globalThis.fetch = jest.fn((url: string) => {
        if (typeof url === 'string' && url.includes('/queue/triggered')) {
          return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(TRIGGERED_RESPONSE) } as Response);
        }
        capturedUrl = url as string;
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve(newData),
        } as Response);
      }) as unknown as typeof fetch;

      fireEvent.change(screen.getByRole('combobox', { name: 'Events time range' }), { target: { value: '2d' } });
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
        paused: false,
        schedulerStale: false,
        lastSchedulerTickAt: null,
      };
      const freshData = {
        nextReviewAvailableAt: null,
        pendingItems: [],
        eventCounts: { detected: 9, enqueued: 0, retriggered: 0, failed: 0 },
        paused: false,
        schedulerStale: false,
        lastSchedulerTickAt: null,
      };

      mockDashboardState({
        nextReviewAvailableAt: null,
        pendingItems: [],
        eventCounts: DEFAULT_EVENT_COUNTS,
        paused: false,
      });
      renderSummaryStats();
      await waitFor(() => expect(screen.getByText('8')).toBeInTheDocument());

      let resolveStale: (v: Response) => void;
      const stalePromise = new Promise<Response>((r) => {
        resolveStale = r;
      });

      let callCount = 0;
      globalThis.fetch = jest.fn((url: string) => {
        if (typeof url === 'string' && url.includes('/queue/triggered')) {
          return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(TRIGGERED_RESPONSE) } as Response);
        }
        callCount++;
        if (callCount === 1) return stalePromise;
        return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(freshData) } as Response);
      }) as unknown as typeof fetch;

      // Two rapid duration changes: first is stale (pending), second resolves immediately.
      fireEvent.change(screen.getByRole('combobox', { name: 'Events time range' }), { target: { value: '2d' } });
      fireEvent.change(screen.getByRole('combobox', { name: 'Events time range' }), { target: { value: '3d' } });

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
        paused: false,
        schedulerStale: false,
        lastSchedulerTickAt: null,
      };

      mockDashboardState({
        nextReviewAvailableAt: null,
        pendingItems: [],
        eventCounts: DEFAULT_EVENT_COUNTS,
        paused: false,
      });
      renderSummaryStats();
      await waitFor(() => expect(screen.getByText('8')).toBeInTheDocument());

      let rejectStale: (err: Error) => void;
      const stalePromise = new Promise<Response>((_resolve, reject) => {
        rejectStale = reject;
      });

      let callCount = 0;
      globalThis.fetch = jest.fn((url: string) => {
        if (typeof url === 'string' && url.includes('/queue/triggered')) {
          return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(TRIGGERED_RESPONSE) } as Response);
        }
        callCount++;
        if (callCount === 1) return stalePromise;
        return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(freshData) } as Response);
      }) as unknown as typeof fetch;

      // Two rapid duration changes: first will error, second succeeds.
      fireEvent.change(screen.getByRole('combobox', { name: 'Events time range' }), { target: { value: '2d' } });
      fireEvent.change(screen.getByRole('combobox', { name: 'Events time range' }), { target: { value: '3d' } });

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
      lastSchedulerTickAt: null,
      pendingItems: [],
      eventCounts: DEFAULT_EVENT_COUNTS,
      paused: false,
      schedulerStale: false,
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
      await waitFor(() => expect(screen.getByText('Next review')).toBeInTheDocument());
    });
  });

  describe('scheduler stale banner', () => {
    it('renders banner when schedulerStale is true with a timestamp', async () => {
      const now = new Date();
      const tickTime = new Date(now.getTime() - 120_000).toISOString();
      mockDashboardState({
        lastSchedulerTickAt: tickTime,
        nextReviewAvailableAt: null,
        pendingItems: [],
        eventCounts: DEFAULT_EVENT_COUNTS,
        paused: false,
        schedulerStale: true,
      });
      renderSummaryStats();
      await waitFor(() => expect(screen.getByText(/Scheduler may be down/)).toBeInTheDocument());
      expect(screen.getByText(/no heartbeat for 2 minutes/)).toBeInTheDocument();
    });

    it('renders "no heartbeat yet" when lastSchedulerTickAt is null', async () => {
      mockDashboardState({
        lastSchedulerTickAt: null,
        nextReviewAvailableAt: null,
        pendingItems: [],
        eventCounts: DEFAULT_EVENT_COUNTS,
        paused: false,
        schedulerStale: true,
      });
      renderSummaryStats();
      await waitFor(() => expect(screen.getByText(/no heartbeat yet/)).toBeInTheDocument());
    });

    it('does not render banner when schedulerStale is false', async () => {
      mockDashboardState({
        lastSchedulerTickAt: new Date().toISOString(),
        nextReviewAvailableAt: null,
        pendingItems: [],
        eventCounts: DEFAULT_EVENT_COUNTS,
        paused: false,
        schedulerStale: false,
      });
      renderSummaryStats();
      await waitFor(() => expect(screen.getByText('Queue Order — 0 pending item(s)')).toBeInTheDocument());
      expect(screen.queryByText(/Scheduler may be down/)).not.toBeInTheDocument();
    });

    it('shows seconds for recent heartbeat', async () => {
      const now = new Date();
      const tickTime = new Date(now.getTime() - 30_000).toISOString();
      mockDashboardState({
        lastSchedulerTickAt: tickTime,
        nextReviewAvailableAt: null,
        pendingItems: [],
        eventCounts: DEFAULT_EVENT_COUNTS,
        paused: false,
        schedulerStale: true,
      });
      renderSummaryStats();
      await waitFor(() => expect(screen.getByText(/no heartbeat for 30 seconds/)).toBeInTheDocument());
    });

    it('shows hours for very old heartbeat', async () => {
      const now = new Date();
      const tickTime = new Date(now.getTime() - 3600 * 1000 * 2).toISOString();
      mockDashboardState({
        lastSchedulerTickAt: tickTime,
        nextReviewAvailableAt: null,
        pendingItems: [],
        eventCounts: DEFAULT_EVENT_COUNTS,
        paused: false,
        schedulerStale: true,
      });
      renderSummaryStats();
      await waitFor(() => expect(screen.getByText(/no heartbeat for 2 hours/)).toBeInTheDocument());
    });
  });

  describe('cleanup', () => {
    it('cancels in-flight fetch on unmount', () => {
      mockDashboardState({
        lastSchedulerTickAt: null,
        nextReviewAvailableAt: null,
        pendingItems: [],
        eventCounts: DEFAULT_EVENT_COUNTS,
        paused: false,
        schedulerStale: false,
      });
      const { unmount } = renderSummaryStats();
      unmount();
      expect(globalThis.fetch).toHaveBeenCalled();
    });

    it('ignores fetch resolution after component unmounts', async () => {
      let resolveFetch: (v: Response) => void;
      const pending = new Promise<Response>((r) => {
        resolveFetch = r;
      });
      let callCount = 0;
      globalThis.fetch = jest.fn(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve(DEFAULT_CONFIG_RESPONSE),
          } as Response);
        }
        return pending;
      }) as unknown as typeof fetch;

      const { unmount } = renderSummaryStats();
      unmount();

      resolveFetch!({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            nextReviewAvailableAt: null,
            pendingItems: [],
            eventCounts: { detected: 0, enqueued: 0, retriggered: 0, failed: 0 },
            paused: false,
          }),
      } as Response);

      await new Promise((r) => setTimeout(r, 0));
    });

    it('ignores fetch rejection after component unmounts', async () => {
      let rejectFetch: (err: Error) => void;
      const pending = new Promise<Response>((_resolve, reject) => {
        rejectFetch = reject;
      });
      let callCount2 = 0;
      globalThis.fetch = jest.fn(() => {
        callCount2++;
        if (callCount2 === 1) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve(DEFAULT_CONFIG_RESPONSE),
          } as Response);
        }
        return pending;
      }) as unknown as typeof fetch;

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
        paused: false,
      });

      render(
        <StrictMode>
          <TimezoneProvider>
            <ErrorProvider>
              <GlobalErrorBanner />
              <SummaryStats />
            </ErrorProvider>
          </TimezoneProvider>
        </StrictMode>,
      );
      await waitFor(() => expect(screen.getByText('Queue Order — 0 pending item(s)')).toBeInTheDocument());
    });

    it('re-fetches dashboard state when QueueOrder calls onMoveComplete', async () => {
      const repo = getUniqueGitHubRepoRef().fullName;
      const prNumber = getUniqueInt();
      const queueItem = {
        uuid: getUuid(),
        repo_full_name: repo,
        pr_number: prNumber,
        status: 'pending',
        attempts: 0,
        trigger_source: 'scheduler',
        pull_request_id: getUniqueInt(),
        created_at: getUniqueDate().toISOString(),
        updated_at: getUniqueDate().toISOString(),
      };
      const initialData = {
        nextReviewAvailableAt: null,
        pendingItems: [queueItem],
        eventCounts: { detected: 1, enqueued: 0, retriggered: 0, failed: 0 },
        paused: false,
      };
      const refreshedData = {
        nextReviewAvailableAt: null,
        pendingItems: [queueItem],
        eventCounts: { detected: 2, enqueued: 0, retriggered: 0, failed: 0 },
        paused: false,
      };

      let dashboardCallCount = 0;
      globalThis.fetch = jest.fn((url: string, init?: RequestInit) => {
        if (init?.method === 'POST') {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve({ data: [queueItem] }),
          } as Response);
        }
        if (typeof url === 'string' && url.includes('/queue/triggered')) {
          return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(TRIGGERED_RESPONSE) } as Response);
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

      fireEvent.click(screen.getByLabelText(`Select ${repo} #${prNumber}`));
      fireEvent.click(screen.getByText('Move Up'));

      await waitFor(() => expect(screen.getByText('2')).toBeInTheDocument());
    });
  });

  describe('pause toggle', () => {
    const dashboardData = {
      lastSchedulerTickAt: null,
      nextReviewAvailableAt: null,
      pendingItems: [],
      eventCounts: DEFAULT_EVENT_COUNTS,
      paused: false,
      schedulerStale: false,
    };

    it('renders Pause button when not paused', async () => {
      mockDashboardState(dashboardData);
      renderSummaryStats();
      await waitFor(() => expect(screen.getByText('Pause')).toBeInTheDocument());
    });

    it('renders Resume button when paused', async () => {
      mockDashboardState({ ...dashboardData, paused: true });
      renderSummaryStats();
      await waitFor(() => expect(screen.getByText('Resume')).toBeInTheDocument());
    });

    it('calls setPaused API on pause button click', async () => {
      mockDashboardState(dashboardData);
      renderSummaryStats();
      await waitFor(() => expect(screen.getByText('Pause')).toBeInTheDocument());

      const refreshedData = { ...dashboardData, paused: true };
      globalThis.fetch = jest.fn((_url: string, init?: RequestInit) => {
        if (init?.method === 'POST') {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve({ paused: true }),
          } as Response);
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve(refreshedData),
        } as Response);
      }) as unknown as typeof fetch;

      fireEvent.click(screen.getByText('Pause'));

      await waitFor(() => {
        expect(globalThis.fetch).toHaveBeenCalledWith('/api/pause', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ paused: true }),
        });
      });
    });

    it('calls setPaused API on resume button click', async () => {
      mockDashboardState({ ...dashboardData, paused: true });
      renderSummaryStats();
      await waitFor(() => expect(screen.getByText('Resume')).toBeInTheDocument());

      const refreshedData = { ...dashboardData, paused: false };
      globalThis.fetch = jest.fn((_url: string, init?: RequestInit) => {
        if (init?.method === 'POST') {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve({ paused: false }),
          } as Response);
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve(refreshedData),
        } as Response);
      }) as unknown as typeof fetch;

      fireEvent.click(screen.getByText('Resume'));

      await waitFor(() => {
        expect(globalThis.fetch).toHaveBeenCalledWith('/api/pause', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ paused: false }),
        });
      });
    });

    it('handles setPaused API failure gracefully', async () => {
      mockDashboardState(dashboardData);
      renderSummaryStats();
      await waitFor(() => expect(screen.getByText('Pause')).toBeInTheDocument());

      globalThis.fetch = jest.fn(() => Promise.reject(new Error('Network error'))) as unknown as typeof fetch;

      fireEvent.click(screen.getByText('Pause'));

      await waitFor(() => expect(screen.getByText('Pause')).toBeInTheDocument());
    });

    it('does not update state on unmount during setPaused success', async () => {
      mockDashboardState(dashboardData);
      const { unmount } = renderSummaryStats();
      await waitFor(() => expect(screen.getByText('Pause')).toBeInTheDocument());

      let resolveSetPaused: (v: Response) => void;
      const pendingSetPaused = new Promise<Response>((r) => {
        resolveSetPaused = r;
      });
      globalThis.fetch = jest.fn(() => pendingSetPaused) as unknown as typeof fetch;

      fireEvent.click(screen.getByText('Pause'));
      unmount();

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      resolveSetPaused!({ ok: true, status: 200, json: () => Promise.resolve({ paused: true }) } as Response);
      await new Promise((r) => setTimeout(r, 0));

      const stateUpdateWarnings = consoleErrorSpy.mock.calls.filter((call) => typeof call[0] === 'string' && (call[0] as string).includes('unmounted'));
      expect(stateUpdateWarnings).toHaveLength(0);
    });

    it('does not update state on unmount during setPaused failure', async () => {
      mockDashboardState(dashboardData);
      const { unmount } = renderSummaryStats();
      await waitFor(() => expect(screen.getByText('Pause')).toBeInTheDocument());

      let rejectSetPaused!: (err: Error) => void;
      const pendingSetPaused = new Promise<Response>((_, reject) => {
        rejectSetPaused = reject;
      });
      globalThis.fetch = jest.fn(() => pendingSetPaused) as unknown as typeof fetch;

      fireEvent.click(screen.getByText('Pause'));
      unmount();

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      rejectSetPaused(new Error('Network error'));
      await new Promise((r) => setTimeout(r, 0));

      const stateUpdateWarnings = consoleErrorSpy.mock.calls.filter((call) => typeof call[0] === 'string' && (call[0] as string).includes('unmounted'));
      expect(stateUpdateWarnings).toHaveLength(0);
    });
  });

  describe('error', () => {
    it('shows error message on HTTP failure', async () => {
      globalThis.fetch = jest.fn((url: string) => {
        if (typeof url === 'string' && url.includes('/api/config')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve(DEFAULT_CONFIG_RESPONSE),
          } as Response);
        }
        return Promise.resolve({ ok: false, status: 500, json: () => Promise.resolve({ error: 'Internal server error' }) } as Response);
      }) as unknown as typeof fetch;
      renderSummaryStats();
      await waitFor(() => expect(screen.getByText('Internal server error')).toBeInTheDocument());
    });

    it('shows generic error message when fetch rejects', async () => {
      globalThis.fetch = jest.fn((url: string) => {
        if (typeof url === 'string' && url.includes('/api/config')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve(DEFAULT_CONFIG_RESPONSE),
          } as Response);
        }
        return Promise.reject(new Error('Network error'));
      }) as unknown as typeof fetch;
      renderSummaryStats();
      await waitFor(() => expect(screen.getByText('Network error')).toBeInTheDocument());
    });

    it('uses known lastTick to compute staleness on fetch error', async () => {
      const now = new Date();
      const tickTime = new Date(now.getTime() - 120_000).toISOString();
      mockDashboardState({
        lastSchedulerTickAt: tickTime,
        nextReviewAvailableAt: null,
        pendingItems: [],
        eventCounts: DEFAULT_EVENT_COUNTS,
        paused: false,
      });
      renderSummaryStats();
      await waitFor(() => expect(screen.getByText('8')).toBeInTheDocument());

      globalThis.fetch = jest.fn((url: string) => {
        if (typeof url === 'string' && url.includes('/api/config')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve({ pauseNotificationInitialDelaySec: 1800, pauseNotificationRepeatIntervalSec: 900, schedulerStaleThresholdMs: 30000 }),
          } as Response);
        }
        return Promise.reject(new Error('Background refresh failed'));
      }) as unknown as typeof fetch;

      fireEvent.change(screen.getByRole('combobox', { name: 'Events time range' }), { target: { value: '2d' } });

      await waitFor(() => expect(screen.getByText('Background refresh failed')).toBeInTheDocument());
    });

    it('shows refresh error banner alongside data when background poll fails', async () => {
      mockDashboardState({
        nextReviewAvailableAt: null,
        pendingItems: [],
        eventCounts: DEFAULT_EVENT_COUNTS,
        paused: false,
      });
      renderSummaryStats();
      await waitFor(() => expect(screen.getByText('8')).toBeInTheDocument());

      globalThis.fetch = jest.fn(() => Promise.reject(new Error('Background refresh failed'))) as unknown as typeof fetch;

      fireEvent.change(screen.getByRole('combobox', { name: 'Events time range' }), { target: { value: '2d' } });

      await waitFor(() => expect(screen.getByText('Background refresh failed')).toBeInTheDocument());
      expect(screen.getByText('8')).toBeInTheDocument();
    });

    it('uses default stale threshold when config fetch fails', async () => {
      globalThis.fetch = jest.fn((url: string) => {
        if (url === '/api/config') {
          return Promise.resolve({
            ok: false,
            status: 500,
            json: () => Promise.resolve({ error: 'Config fetch failed' }),
          } as Response);
        }
        if (typeof url === 'string' && url.includes('/queue/triggered')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve(TRIGGERED_RESPONSE),
          } as Response);
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve({
              lastSchedulerTickAt: null,
              nextReviewAvailableAt: null,
              pendingItems: [],
              eventCounts: DEFAULT_EVENT_COUNTS,
              paused: false,
              schedulerStale: false,
            }),
        } as Response);
      }) as unknown as typeof fetch;
      renderSummaryStats();
      await waitFor(() => expect(screen.getByText('Summary')).toBeInTheDocument());
    });
  });
});
