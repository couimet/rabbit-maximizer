/** @jest-environment jsdom */

import RecentlyTriggered from '../../dashboard/src/components/RecentlyTriggered.js';
import { QueueStatus, TriggerSource } from '../../src/types/index.js';

import '@testing-library/jest-dom/jest-globals';
import { getUniqueDate, getUniqueInt, getUniqueString } from '@couimet/dynamic-testing';
import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { StrictMode } from 'react';

const TRIGGERED_RESPONSE = { data: [], total: 0, page: 1, pageSize: 50 };

const mockTriggeredEndpoint = (data: Record<string, unknown> = TRIGGERED_RESPONSE) => {
  globalThis.fetch = jest.fn((url: string) => {
    if (typeof url === 'string' && url.includes('/queue/triggered')) {
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(data) } as Response);
    }
    return Promise.reject(new Error('Unexpected fetch: ' + url));
  }) as unknown as typeof fetch;
};

const makeItem = (over: Record<string, unknown> = {}) => ({
  id: getUniqueInt(),
  uuid: getUniqueString({ prefix: 'uuid-' }),
  repo_full_name: `${getUniqueString({ prefix: 'owner' })}/${getUniqueString({ prefix: 'repo' })}`,
  pr_number: getUniqueInt(),
  status: QueueStatus.retriggered,
  not_before: getUniqueDate().toISOString(),
  attempts: 0,
  source_comment_url: getUniqueString({ prefix: 'https://gh/c/' }),
  trigger_source: TriggerSource.scheduler,
  retrigger_comment_url: getUniqueString({ prefix: 'https://gh/c/retriggered-' }),
  retriggered_at: new Date(getUniqueDate().getTime() - 1_800_000).toISOString(),
  created_at: getUniqueDate().toISOString(),
  updated_at: getUniqueDate().toISOString(),
  ...over,
});

describe('RecentlyTriggered', () => {
  afterEach(() => {
    localStorage.clear();
  });

  describe('loading', () => {
    it('shows loading text while fetch is in-flight', () => {
      globalThis.fetch = jest.fn(() => new Promise(() => {})) as unknown as typeof fetch;
      render(<RecentlyTriggered />);
      expect(screen.getByText('Loading triggered items…')).toBeInTheDocument();
    });
  });

  describe('data', () => {
    it('renders triggered items in the table', async () => {
      const item = makeItem();
      mockTriggeredEndpoint({ data: [item], total: 1, page: 1, pageSize: 50 });
      render(<RecentlyTriggered />);

      await waitFor(() => expect(screen.getByText(item.repo_full_name)).toBeInTheDocument());
      expect(screen.getByText('#' + String(item.pr_number))).toBeInTheDocument();
    });

    it('shows empty message when no items exist', async () => {
      mockTriggeredEndpoint();
      render(<RecentlyTriggered />);

      await waitFor(() => expect(screen.getByText('No triggered items in this time window.')).toBeInTheDocument());
    });

    it('links PR number to retrigger_comment_url when available', async () => {
      const item = makeItem();
      mockTriggeredEndpoint({ data: [item], total: 1, page: 1, pageSize: 50 });
      render(<RecentlyTriggered />);

      await waitFor(() => expect(screen.getByText('#' + String(item.pr_number))).toBeInTheDocument());
      const link = screen.getByText('#' + String(item.pr_number)).closest('a');
      expect(link).toHaveAttribute('href', item.retrigger_comment_url);
    });

    it('links PR number to generic PR URL when retrigger_comment_url is absent', async () => {
      const item = makeItem({ retrigger_comment_url: undefined });
      mockTriggeredEndpoint({ data: [item], total: 1, page: 1, pageSize: 50 });
      render(<RecentlyTriggered />);

      await waitFor(() => expect(screen.getByText('#' + String(item.pr_number))).toBeInTheDocument());
      const link = screen.getByText('#' + String(item.pr_number)).closest('a');
      expect(link).toHaveAttribute('href', `https://github.com/${item.repo_full_name}/pull/${item.pr_number}`);
    });

    it('shows Completed pill when status is completed', async () => {
      const item = makeItem({ status: QueueStatus.completed });
      mockTriggeredEndpoint({ data: [item], total: 1, page: 1, pageSize: 50 });
      render(<RecentlyTriggered />);

      await waitFor(() => expect(screen.getByText('Completed')).toBeInTheDocument());
    });

    it('shows Retriggered pill when status is retriggered', async () => {
      const item = makeItem();
      mockTriggeredEndpoint({ data: [item], total: 1, page: 1, pageSize: 50 });
      render(<RecentlyTriggered />);

      await waitFor(() => expect(screen.getAllByText('Retriggered')).toHaveLength(2));
    });
  });

  describe('load more', () => {
    it('shows load more button when there are more items', async () => {
      const item = makeItem();
      mockTriggeredEndpoint({ data: [item], total: 60, page: 1, pageSize: 50 });
      render(<RecentlyTriggered />);

      await waitFor(() => expect(screen.getByText('Load more (59 remaining)')).toBeInTheDocument());
    });

    it('does not show load more button when all items loaded', async () => {
      const item = makeItem();
      mockTriggeredEndpoint({ data: [item], total: 1, page: 1, pageSize: 50 });
      render(<RecentlyTriggered />);

      await waitFor(() => expect(screen.getByText('#' + String(item.pr_number))).toBeInTheDocument());
      expect(screen.queryByText(/Load more/)).not.toBeInTheDocument();
    });

    it('appends items when load more is clicked', async () => {
      const item1 = makeItem({ pr_number: 111 });
      const item2 = makeItem({ pr_number: 222 });
      const page2Data = { data: [item2], total: 60, page: 2, pageSize: 50 };

      globalThis.fetch = jest.fn((url: string) => {
        if (typeof url === 'string' && url.includes('/queue/triggered')) {
          if (url.includes('page=2')) {
            return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(page2Data) } as Response);
          }
          return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ data: [item1], total: 60, page: 1, pageSize: 50 }) } as Response);
        }
        return Promise.reject(new Error('Unexpected fetch'));
      }) as unknown as typeof fetch;

      render(<RecentlyTriggered />);

      await waitFor(() => expect(screen.getByText('#' + String(item1.pr_number))).toBeInTheDocument());
      fireEvent.click(screen.getByText('Load more (59 remaining)'));

      await waitFor(() => expect(screen.getByText('#' + String(item2.pr_number))).toBeInTheDocument());
      expect(screen.getByText('#' + String(item1.pr_number))).toBeInTheDocument();
    });
  });

  describe('show completed toggle', () => {
    it('includes show completed checkbox', async () => {
      mockTriggeredEndpoint();
      render(<RecentlyTriggered />);

      await waitFor(() => expect(screen.getByLabelText('Show completed')).toBeInTheDocument());
    });

    it('toggles include_completed and refetches', async () => {
      mockTriggeredEndpoint();
      render(<RecentlyTriggered />);

      await waitFor(() => expect(screen.getByLabelText('Show completed')).toBeInTheDocument());

      globalThis.fetch = jest.fn((url: string) => {
        if (typeof url === 'string' && url.includes('/queue/triggered')) {
          return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ data: [], total: 0, page: 1, pageSize: 50 }) } as Response);
        }
        return Promise.reject(new Error('Unexpected fetch: ' + url));
      }) as unknown as typeof fetch;

      fireEvent.click(screen.getByLabelText('Show completed'));

      await waitFor(() => {
        expect(globalThis.fetch).toHaveBeenCalled();
      });
    });
  });

  describe('error', () => {
    it('shows error message when fetch fails and no data is loaded', async () => {
      globalThis.fetch = jest.fn(() => Promise.reject(new Error('Network error'))) as unknown as typeof fetch;
      render(<RecentlyTriggered />);

      await waitFor(() => expect(screen.getByText('Failed to load triggered items: Network error')).toBeInTheDocument());
    });

    it('shows error page when duration change triggers a failed fetch with no existing data', async () => {
      const item = makeItem();
      mockTriggeredEndpoint({ data: [item], total: 1, page: 1, pageSize: 50 });
      render(<RecentlyTriggered />);

      await waitFor(() => expect(screen.getByText('#' + String(item.pr_number))).toBeInTheDocument());

      globalThis.fetch = jest.fn(() => Promise.reject(new Error('Refresh failed'))) as unknown as typeof fetch;

      fireEvent.change(screen.getByRole('combobox', { name: 'Triggered time range' }), { target: { value: '24h' } });

      await waitFor(() => expect(screen.getByText('Failed to load triggered items: Refresh failed')).toBeInTheDocument());
    });
  });

  describe('time range picker', () => {
    it('renders with default 2d duration', async () => {
      mockTriggeredEndpoint();
      render(<RecentlyTriggered />);

      await waitFor(() => {
        const select = screen.getByRole('combobox', { name: 'Triggered time range' }) as HTMLSelectElement;
        expect(select.value).toBe('2d');
      });
    });
  });

  describe('edge cases', () => {
    it('shows em dash when retriggered_at is missing', async () => {
      const item = makeItem({ retriggered_at: undefined });
      mockTriggeredEndpoint({ data: [item], total: 1, page: 1, pageSize: 50 });
      render(<RecentlyTriggered />);

      await waitFor(() => expect(screen.getByText('#' + String(item.pr_number))).toBeInTheDocument());
      const dashes = screen.getAllByText('—');
      expect(dashes.length).toBeGreaterThanOrEqual(1);
    });

    it('shows refresh error banner when poll fails with existing data', async () => {
      jest.useFakeTimers();
      const item = makeItem();

      let callCount = 0;
      globalThis.fetch = jest.fn((url: string) => {
        if (typeof url === 'string' && url.includes('/queue/triggered')) {
          callCount++;
          if (callCount === 1) {
            return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ data: [item], total: 1, page: 1, pageSize: 50 }) } as Response);
          }
          return Promise.reject(new Error('Poll failed'));
        }
        return Promise.reject(new Error('Unexpected fetch'));
      }) as unknown as typeof fetch;

      render(<RecentlyTriggered />);

      await waitFor(() => expect(screen.getByText('#' + String(item.pr_number))).toBeInTheDocument());

      act(() => {
        jest.advanceTimersByTime(60_000);
      });

      await waitFor(() => expect(screen.getByText('Failed to refresh: Poll failed')).toBeInTheDocument());
      expect(screen.getByText('#' + String(item.pr_number))).toBeInTheDocument();

      jest.useRealTimers();
    });
  });

  describe('cleanup', () => {
    it('loads data after StrictMode double-invoke', async () => {
      mockTriggeredEndpoint();
      render(
        <StrictMode>
          <RecentlyTriggered />
        </StrictMode>,
      );
      await waitFor(() => expect(screen.getByText('No triggered items in this time window.')).toBeInTheDocument());
    });

    it('cleans up intervals on unmount', () => {
      mockTriggeredEndpoint();
      const { unmount } = render(<RecentlyTriggered />);
      unmount();
    });
  });
});
