/** @jest-environment jsdom */

import { ErrorProvider, GlobalErrorBanner, RecentlyTriggered } from '../../dashboard/src/index.js';
import type { QueueItemResponse } from '../../src/types/index.js';
import { generateQueueItemResponseData, generateReviewRef } from '../helpers/index.js';

import '@testing-library/jest-dom/jest-globals';
import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { type ReactElement, StrictMode } from 'react';

const PAGE_SIZE = 50;
const TRIGGERED_RESPONSE = { data: [], total: 0, page: 1, pageSize: PAGE_SIZE };

const mockTriggeredEndpoint = (data: Record<string, unknown> = TRIGGERED_RESPONSE) => {
  globalThis.fetch = jest.fn((url: string) => {
    if (typeof url === 'string' && url.includes('/queue/triggered')) {
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(data) } as Response);
    }
    return Promise.reject(new Error('Unexpected fetch: ' + url));
  }) as unknown as typeof fetch;
};

const makeItem = (over: Record<string, unknown> = {}) =>
  generateQueueItemResponseData({ status: 'retriggered', retrigger_comment_url: generateReviewRef().commentUrl, ...over } as Partial<QueueItemResponse>);

const renderRecentlyTriggered = (ui?: ReactElement) =>
  render(
    <ErrorProvider>
      <GlobalErrorBanner />
      {ui ?? <RecentlyTriggered />}
    </ErrorProvider>,
  );

describe('RecentlyTriggered', () => {
  afterEach(() => {
    localStorage.clear();
  });

  describe('loading', () => {
    it('shows loading text while fetch is in-flight', () => {
      globalThis.fetch = jest.fn(() => new Promise(() => {})) as unknown as typeof fetch;
      renderRecentlyTriggered();
      expect(screen.getByText('Loading triggered items…')).toBeInTheDocument();
    });
  });

  describe('data', () => {
    it('renders triggered items in the table', async () => {
      const item = makeItem();
      mockTriggeredEndpoint({ data: [item], total: 1, page: 1, pageSize: PAGE_SIZE });
      renderRecentlyTriggered();

      await waitFor(() => expect(screen.getByText(item.pr_title + ' (#' + item.pr_number + ')')).toBeInTheDocument());
      expect(screen.getByText((content) => content.includes('by ' + item.author_login))).toBeInTheDocument();
    });

    it('shows empty message when no items exist', async () => {
      mockTriggeredEndpoint();
      renderRecentlyTriggered();

      await waitFor(() => expect(screen.getByText('No triggered items in this time window.')).toBeInTheDocument());
    });

    it('links PR number to retrigger_comment_url when available', async () => {
      const item = makeItem();
      mockTriggeredEndpoint({ data: [item], total: 1, page: 1, pageSize: PAGE_SIZE });
      renderRecentlyTriggered();

      await waitFor(() => expect(screen.getByText(item.pr_title + ' (#' + item.pr_number + ')')).toBeInTheDocument());
      const link = screen.getByText(item.pr_title + ' (#' + item.pr_number + ')').closest('a');
      expect(link).toHaveAttribute('href', item.retrigger_comment_url);
    });

    it('links PR number to generic PR URL when retrigger_comment_url is absent', async () => {
      const item = makeItem({ retrigger_comment_url: undefined });
      mockTriggeredEndpoint({ data: [item], total: 1, page: 1, pageSize: PAGE_SIZE });
      renderRecentlyTriggered();

      await waitFor(() => expect(screen.getByText(item.pr_title + ' (#' + item.pr_number + ')')).toBeInTheDocument());
      const link = screen.getByText(item.pr_title + ' (#' + item.pr_number + ')').closest('a');
      expect(link).toHaveAttribute('href', `https://github.com/${item.repo_full_name}/pull/${item.pr_number}`);
    });

    it('shows Reviewed pill when status is resolved with review_completed resolution', async () => {
      const item = makeItem({ status: 'resolved', resolution: 'review_completed' });
      mockTriggeredEndpoint({ data: [item], total: 1, page: 1, pageSize: PAGE_SIZE });
      renderRecentlyTriggered();

      await waitFor(() => expect(screen.getByText('Reviewed')).toBeInTheDocument());
    });

    it('shows Resolved pill when status is resolved and resolution is absent', async () => {
      const item = makeItem({ status: 'resolved' });
      mockTriggeredEndpoint({ data: [item], total: 1, page: 1, pageSize: PAGE_SIZE });
      renderRecentlyTriggered();

      await waitFor(() => expect(screen.getByText('Resolved')).toBeInTheDocument());
    });

    it('shows Resolved pill for unknown resolution values', async () => {
      const item = makeItem({ status: 'resolved', resolution: 'custom_reason' });
      mockTriggeredEndpoint({ data: [item], total: 1, page: 1, pageSize: PAGE_SIZE });
      renderRecentlyTriggered();

      await waitFor(() => expect(screen.getByText('Resolved')).toBeInTheDocument());
    });

    it('shows Review limited pill when status is retriggered with no acknowledge', async () => {
      const item = makeItem();
      mockTriggeredEndpoint({ data: [item], total: 1, page: 1, pageSize: PAGE_SIZE });
      renderRecentlyTriggered();

      await waitFor(() => expect(screen.getByText('Review limited')).toBeInTheDocument());
    });
  });

  describe('load more', () => {
    it('shows load more button when there are more items', async () => {
      const item = makeItem();
      mockTriggeredEndpoint({ data: [item], total: 60, page: 1, pageSize: PAGE_SIZE });
      renderRecentlyTriggered();

      await waitFor(() => expect(screen.getByText('Load more (59 remaining)')).toBeInTheDocument());
    });

    it('does not show load more button when all items loaded', async () => {
      const item = makeItem();
      mockTriggeredEndpoint({ data: [item], total: 1, page: 1, pageSize: PAGE_SIZE });
      renderRecentlyTriggered();

      await waitFor(() => expect(screen.getByText(item.pr_title + ' (#' + item.pr_number + ')')).toBeInTheDocument());
      expect(screen.queryByText(/Load more/)).not.toBeInTheDocument();
    });

    it('appends items when load more is clicked', async () => {
      const item1 = makeItem({ pr_number: 111 });
      const item2 = makeItem({ pr_number: 222 });
      const page2Data = { data: [item2], total: 60, page: 2, pageSize: PAGE_SIZE };

      globalThis.fetch = jest.fn((url: string) => {
        if (typeof url === 'string' && url.includes('/queue/triggered')) {
          if (url.includes('page=2')) {
            return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(page2Data) } as Response);
          }
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve({ data: [item1], total: 60, page: 1, pageSize: PAGE_SIZE }),
          } as Response);
        }
        return Promise.reject(new Error('Unexpected fetch'));
      }) as unknown as typeof fetch;

      renderRecentlyTriggered();

      await waitFor(() => expect(screen.getByText(item1.pr_title + ' (#' + item1.pr_number + ')')).toBeInTheDocument());
      fireEvent.click(screen.getByText('Load more (59 remaining)'));

      await waitFor(() => expect(screen.getByText(item2.pr_title + ' (#' + item2.pr_number + ')')).toBeInTheDocument());
      expect(screen.getByText(item1.pr_title + ' (#' + item1.pr_number + ')')).toBeInTheDocument();
    });
  });

  describe('show resolved toggle', () => {
    it('includes show resolved checkbox', async () => {
      mockTriggeredEndpoint();
      renderRecentlyTriggered();

      await waitFor(() => expect(screen.getByLabelText('Show resolved')).toBeInTheDocument());
    });

    it('toggles include_resolved and refetches', async () => {
      mockTriggeredEndpoint();
      renderRecentlyTriggered();

      await waitFor(() => expect(screen.getByLabelText('Show resolved')).toBeInTheDocument());

      globalThis.fetch = jest.fn((url: string) => {
        if (typeof url === 'string' && url.includes('/queue/triggered')) {
          return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ data: [], total: 0, page: 1, pageSize: PAGE_SIZE }) } as Response);
        }
        return Promise.reject(new Error('Unexpected fetch: ' + url));
      }) as unknown as typeof fetch;

      fireEvent.click(screen.getByLabelText('Show resolved'));

      await waitFor(() => {
        const calls = (globalThis.fetch as jest.Mock).mock.calls as unknown[][];
        const triggeredCall = calls.find((call) => String(call[0]).includes('/queue/triggered'));
        expect(triggeredCall).toBeDefined();
        expect(new URL('http://localhost' + String(triggeredCall![0])).searchParams.get('include_resolved')).toBe('true');
      });
    });
  });

  describe('error', () => {
    it('shows error message when fetch fails and no data is loaded', async () => {
      globalThis.fetch = jest.fn(() => Promise.reject(new Error('Network error'))) as unknown as typeof fetch;
      renderRecentlyTriggered();

      await waitFor(() => expect(screen.getByText('Network error')).toBeInTheDocument());
    });

    it('shows error page when duration change triggers a failed fetch with no existing data', async () => {
      const item = makeItem();
      mockTriggeredEndpoint({ data: [item], total: 1, page: 1, pageSize: PAGE_SIZE });
      renderRecentlyTriggered();

      await waitFor(() => expect(screen.getByText(item.pr_title + ' (#' + item.pr_number + ')')).toBeInTheDocument());

      globalThis.fetch = jest.fn(() => Promise.reject(new Error('Refresh failed'))) as unknown as typeof fetch;

      fireEvent.change(screen.getByRole('combobox', { name: 'Triggered time range' }), { target: { value: '24h' } });

      await waitFor(() => expect(screen.getByText('Refresh failed')).toBeInTheDocument());
    });
  });

  describe('time range picker', () => {
    it('renders with default 2d duration', async () => {
      mockTriggeredEndpoint();
      renderRecentlyTriggered();

      await waitFor(() => {
        const select = screen.getByRole('combobox', { name: 'Triggered time range' }) as HTMLSelectElement;
        expect(select.value).toBe('2d');
      });
    });
  });

  describe('edge cases', () => {
    it('shows em dash when retriggered_at is missing', async () => {
      const item = makeItem({ retriggered_at: undefined });
      mockTriggeredEndpoint({ data: [item], total: 1, page: 1, pageSize: PAGE_SIZE });
      renderRecentlyTriggered();

      await waitFor(() => expect(screen.getByText(item.pr_title + ' (#' + item.pr_number + ')')).toBeInTheDocument());
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
            return Promise.resolve({
              ok: true,
              status: 200,
              json: () => Promise.resolve({ data: [item], total: 1, page: 1, pageSize: PAGE_SIZE }),
            } as Response);
          }
          return Promise.reject(new Error('Poll failed'));
        }
        return Promise.reject(new Error('Unexpected fetch'));
      }) as unknown as typeof fetch;

      renderRecentlyTriggered();

      await waitFor(() => expect(screen.getByText(item.pr_title + ' (#' + item.pr_number + ')')).toBeInTheDocument());

      act(() => {
        jest.advanceTimersByTime(60_000);
      });

      await waitFor(() => expect(screen.getByText('Poll failed')).toBeInTheDocument());
      expect(screen.getByText(item.pr_title + ' (#' + item.pr_number + ')')).toBeInTheDocument();
    });
  });

  describe('mark resolved', () => {
    it('optimistically removes item from the list on click', async () => {
      const item = makeItem();
      globalThis.fetch = jest.fn((url: string, _init?: RequestInit) => {
        if (typeof url === 'string' && url.includes('/queue/triggered')) {
          return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ data: [item], total: 1, page: 1, pageSize: 50 }) } as Response);
        }
        if (typeof url === 'string' && url.includes('/mark-reviewed')) {
          return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ ok: true }) } as Response);
        }
        return Promise.reject(new Error('Unexpected fetch'));
      }) as unknown as typeof fetch;

      renderRecentlyTriggered();

      await waitFor(() => expect(screen.getByText(item.pr_title + ' (#' + item.pr_number + ')')).toBeInTheDocument());

      fireEvent.click(screen.getByTitle('Mark as resolved'));

      await waitFor(() => expect(screen.queryByText(item.pr_title + ' (#' + item.pr_number + ')')).not.toBeInTheDocument());
    });

    it('restores items on mark-resolved API failure', async () => {
      const item = makeItem();
      globalThis.fetch = jest.fn((url: string, _init?: RequestInit) => {
        if (typeof url === 'string' && url.includes('/queue/triggered')) {
          return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ data: [item], total: 1, page: 1, pageSize: 50 }) } as Response);
        }
        if (typeof url === 'string' && url.includes('/mark-reviewed')) {
          return Promise.reject(new Error('API error'));
        }
        return Promise.reject(new Error('Unexpected fetch'));
      }) as unknown as typeof fetch;

      renderRecentlyTriggered();

      await waitFor(() => expect(screen.getByText(item.pr_title + ' (#' + item.pr_number + ')')).toBeInTheDocument());

      fireEvent.click(screen.getByTitle('Mark as resolved'));

      await waitFor(() => expect(screen.getByText(item.pr_title + ' (#' + item.pr_number + ')')).toBeInTheDocument());
    });
  });

  describe('cleanup', () => {
    it('loads data after StrictMode double-invoke', async () => {
      mockTriggeredEndpoint();
      render(
        <ErrorProvider>
          <GlobalErrorBanner />
          <StrictMode>
            <RecentlyTriggered />
          </StrictMode>
        </ErrorProvider>,
      );
      await waitFor(() => expect(screen.getByText('No triggered items in this time window.')).toBeInTheDocument());
    });

    it('cleans up intervals on unmount', () => {
      mockTriggeredEndpoint();
      const { unmount } = renderRecentlyTriggered();
      unmount();
    });
  });
});
