/** @jest-environment jsdom */

import { ActivityList, ErrorProvider, GlobalErrorBanner } from '../../dashboard/src/index.js';
import { generateQueueItemResponseData, generateReviewRef } from '../helpers/index.js';

import '@testing-library/jest-dom/jest-globals';
import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { StatusCodes } from 'http-status-codes';
import { type ReactElement, StrictMode } from 'react';

const EMPTY_TOTAL = 0;
const FIRST_PAGE = 1;
const PAGE_SIZE = 50;
const ACTIVITY_LIST_RESPONSE = { data: [], total: EMPTY_TOTAL, page: FIRST_PAGE, pageSize: PAGE_SIZE };

const mockActivityListEndpoint = (data: Record<string, unknown> = ACTIVITY_LIST_RESPONSE) => {
  globalThis.fetch = jest.fn((url: string) => {
    if (typeof url === 'string' && url.includes('/activity-list')) {
      return Promise.resolve({ ok: true, status: StatusCodes.OK, json: () => Promise.resolve(data) } as Response);
    }
    return Promise.reject(new Error('Unexpected fetch: ' + url));
  }) as unknown as typeof fetch;
};

/** @testFixture */
const makeItem = (over: Record<string, unknown> = {}) =>
  generateQueueItemResponseData({ status: 'retriggered', retrigger_comment_url: generateReviewRef().commentUrl, ...over } as Record<string, unknown>);

const renderActivityList = (ui?: ReactElement) =>
  render(
    <ErrorProvider>
      <GlobalErrorBanner />
      {ui ?? <ActivityList schedulerStale={false} lastSchedulerTickAt={null} />}
    </ErrorProvider>,
  );

describe('ActivityList', () => {
  afterEach(() => {
    localStorage.clear();
  });

  describe('loading', () => {
    it('shows loading text while fetch is in-flight', () => {
      globalThis.fetch = jest.fn(() => new Promise(() => {})) as unknown as typeof fetch;
      renderActivityList();
      expect(screen.getByText('Loading activity list…')).toBeInTheDocument();
    });
  });

  describe('data', () => {
    it('renders activity list items in the table', async () => {
      const item = makeItem();
      mockActivityListEndpoint({ data: [item], total: 1, page: 1, pageSize: PAGE_SIZE });
      renderActivityList();

      await waitFor(() => expect(screen.getByText(item.pr_title + ' (#' + item.pr_number + ')')).toBeInTheDocument());
      expect(screen.getByText('by ' + item.author_login)).toBeInTheDocument();
    });

    it('shows empty message when no items exist', async () => {
      mockActivityListEndpoint();
      renderActivityList();

      await waitFor(() => expect(screen.getByText('No activity in this time window.')).toBeInTheDocument());
    });

    it('links PR number to retrigger_comment_url when available', async () => {
      const item = makeItem();
      mockActivityListEndpoint({ data: [item], total: 1, page: 1, pageSize: PAGE_SIZE });
      renderActivityList();

      await waitFor(() => expect(screen.getByText(item.pr_title + ' (#' + item.pr_number + ')')).toBeInTheDocument());
      const link = screen.getByText(item.pr_title + ' (#' + item.pr_number + ')').closest('a');
      expect(link).toHaveAttribute('href', item.retrigger_comment_url);
    });

    it('links PR number to generic PR URL when retrigger_comment_url is absent', async () => {
      const item = makeItem({ retrigger_comment_url: undefined });
      mockActivityListEndpoint({ data: [item], total: 1, page: 1, pageSize: PAGE_SIZE });
      renderActivityList();

      await waitFor(() => expect(screen.getByText(item.pr_title + ' (#' + item.pr_number + ')')).toBeInTheDocument());
      const link = screen.getByText(item.pr_title + ' (#' + item.pr_number + ')').closest('a');
      expect(link).toHaveAttribute('href', `https://github.com/${item.repo_full_name}/pull/${item.pr_number}`);
    });

    it('shows CodeRabbit: completed analysis pill when status is resolved with review_completed resolution', async () => {
      const item = makeItem({ status: 'resolved', resolution: 'review_completed' });
      mockActivityListEndpoint({ data: [item], total: 1, page: 1, pageSize: PAGE_SIZE });
      renderActivityList();

      await waitFor(() => expect(screen.getByText('CodeRabbit: completed analysis')).toBeInTheDocument());
    });

    it('shows CodeRabbit: completed analysis pill when status is resolved and resolution is absent', async () => {
      const item = makeItem({ status: 'resolved' });
      mockActivityListEndpoint({ data: [item], total: 1, page: 1, pageSize: PAGE_SIZE });
      renderActivityList();

      await waitFor(() => expect(screen.getByText('CodeRabbit: completed analysis')).toBeInTheDocument());
    });

    it('shows Pending pill for unknown resolution values (safeDeriveActivityStatus fallback)', async () => {
      const item = makeItem({ status: 'resolved', resolution: 'custom_reason' });
      mockActivityListEndpoint({ data: [item], total: 1, page: 1, pageSize: PAGE_SIZE });
      renderActivityList();

      await waitFor(() => expect(screen.getByText('Pending')).toBeInTheDocument());
    });

    it('shows CodeRabbit review-limited pill when status is retriggered with no acknowledge', async () => {
      const item = makeItem();
      mockActivityListEndpoint({ data: [item], total: 1, page: 1, pageSize: PAGE_SIZE });
      renderActivityList();

      await waitFor(() => expect(screen.getByText('CodeRabbit review-limited')).toBeInTheDocument());
    });
  });

  describe('load more', () => {
    it('shows load more button when there are more items', async () => {
      const item = makeItem();
      mockActivityListEndpoint({ data: [item], total: 60, page: 1, pageSize: PAGE_SIZE });
      renderActivityList();

      await waitFor(() => expect(screen.getByText('Load more (59 remaining)')).toBeInTheDocument());
    });

    it('does not show load more button when all items loaded', async () => {
      const item = makeItem();
      mockActivityListEndpoint({ data: [item], total: 1, page: 1, pageSize: PAGE_SIZE });
      renderActivityList();

      await waitFor(() => expect(screen.getByText(item.pr_title + ' (#' + item.pr_number + ')')).toBeInTheDocument());
      expect(screen.queryByText(/Load more/)).not.toBeInTheDocument();
    });

    it('appends items when load more is clicked', async () => {
      const item1 = makeItem({ pr_number: 111 });
      const item2 = makeItem({ pr_number: 222 });
      const page2Data = { data: [item2], total: 60, page: 2, pageSize: PAGE_SIZE };

      globalThis.fetch = jest.fn((url: string) => {
        if (typeof url === 'string' && url.includes('/activity-list')) {
          if (url.includes('page=2')) {
            return Promise.resolve({ ok: true, status: StatusCodes.OK, json: () => Promise.resolve(page2Data) } as Response);
          }
          return Promise.resolve({
            ok: true,
            status: StatusCodes.OK,
            json: () => Promise.resolve({ data: [item1], total: 60, page: 1, pageSize: PAGE_SIZE }),
          } as Response);
        }
        return Promise.reject(new Error('Unexpected fetch'));
      }) as unknown as typeof fetch;

      renderActivityList();

      await waitFor(() => expect(screen.getByText(item1.pr_title + ' (#' + item1.pr_number + ')')).toBeInTheDocument());
      fireEvent.click(screen.getByText('Load more (59 remaining)'));

      await waitFor(() => expect(screen.getByText(item2.pr_title + ' (#' + item2.pr_number + ')')).toBeInTheDocument());
      expect(screen.getByText(item1.pr_title + ' (#' + item1.pr_number + ')')).toBeInTheDocument();
    });
  });

  describe('no show resolved toggle', () => {
    it('does not include show resolved checkbox', async () => {
      mockActivityListEndpoint();
      renderActivityList();

      await waitFor(() => expect(screen.getByText('No activity in this time window.')).toBeInTheDocument());
      expect(screen.queryByLabelText('Show resolved')).not.toBeInTheDocument();
    });
  });

  describe('error', () => {
    it('shows error message when fetch fails and no data is loaded', async () => {
      globalThis.fetch = jest.fn(() => Promise.reject(new Error('Network error'))) as unknown as typeof fetch;
      renderActivityList();

      await waitFor(() => expect(screen.getByText('Activity list: Network error')).toBeInTheDocument());
    });

    it('shows error message when duration change triggers a failed fetch with no existing data', async () => {
      const item = makeItem();
      mockActivityListEndpoint({ data: [item], total: 1, page: 1, pageSize: PAGE_SIZE });
      renderActivityList();

      await waitFor(() => expect(screen.getByText(item.pr_title + ' (#' + item.pr_number + ')')).toBeInTheDocument());

      globalThis.fetch = jest.fn(() => Promise.reject(new Error('Refresh failed'))) as unknown as typeof fetch;

      fireEvent.change(screen.getByRole('combobox', { name: 'Activity time range' }), { target: { value: '24h' } });

      await waitFor(() => expect(screen.getByText('Activity list: Refresh failed')).toBeInTheDocument());
    });
  });

  describe('time range picker', () => {
    it('renders with default 2d duration', async () => {
      mockActivityListEndpoint();
      renderActivityList();

      await waitFor(() => {
        const select = screen.getByRole('combobox', { name: 'Activity time range' }) as HTMLSelectElement;
        expect(select.value).toBe('2d');
      });
    });
  });

  describe('edge cases', () => {
    it('shows em dash when last_activity_at is missing', async () => {
      const item = makeItem({ status: 'retriggered', last_activity_at: null });
      mockActivityListEndpoint({ data: [item], total: 1, page: 1, pageSize: PAGE_SIZE });
      renderActivityList();

      await waitFor(() => expect(screen.getByText('—')).toBeInTheDocument());
    });

    it('shows refresh error banner when poll fails with existing data', async () => {
      jest.useFakeTimers();
      const item = makeItem();

      let callCount = 0;
      globalThis.fetch = jest.fn((url: string) => {
        if (typeof url === 'string' && url.includes('/activity-list')) {
          callCount++;
          if (callCount === 1) {
            return Promise.resolve({
              ok: true,
              status: StatusCodes.OK,
              json: () => Promise.resolve({ data: [item], total: 1, page: 1, pageSize: PAGE_SIZE }),
            } as Response);
          }
          return Promise.reject(new Error('Poll failed'));
        }
        return Promise.reject(new Error('Unexpected fetch'));
      }) as unknown as typeof fetch;

      renderActivityList();

      await waitFor(() => expect(screen.getByText(item.pr_title + ' (#' + item.pr_number + ')')).toBeInTheDocument());

      act(() => {
        jest.advanceTimersByTime(60_000);
      });

      await waitFor(() => expect(screen.getByText('Activity list: Poll failed')).toBeInTheDocument());
      expect(screen.getByText(item.pr_title + ' (#' + item.pr_number + ')')).toBeInTheDocument();
    });
  });

  describe('mark resolved', () => {
    it('optimistically removes item from the list on click', async () => {
      const item = makeItem();
      globalThis.fetch = jest.fn((url: string, _init?: RequestInit) => {
        if (typeof url === 'string' && url.includes('/activity-list')) {
          return Promise.resolve({
            ok: true,
            status: StatusCodes.OK,
            json: () => Promise.resolve({ data: [item], total: 1, page: 1, pageSize: 50 }),
          } as Response);
        }
        if (typeof url === 'string' && url.includes('/mark-reviewed')) {
          return Promise.resolve({ ok: true, status: StatusCodes.OK, json: () => Promise.resolve({ ok: true }) } as Response);
        }
        return Promise.reject(new Error('Unexpected fetch'));
      }) as unknown as typeof fetch;

      renderActivityList();

      await waitFor(() => expect(screen.getByText(item.pr_title + ' (#' + item.pr_number + ')')).toBeInTheDocument());

      fireEvent.click(screen.getByTitle('Mark as resolved'));

      await waitFor(() => expect(screen.queryByText(item.pr_title + ' (#' + item.pr_number + ')')).not.toBeInTheDocument());
    });

    it('restores items on mark-resolved API failure', async () => {
      const item = makeItem();
      globalThis.fetch = jest.fn((url: string, _init?: RequestInit) => {
        if (typeof url === 'string' && url.includes('/activity-list')) {
          return Promise.resolve({
            ok: true,
            status: StatusCodes.OK,
            json: () => Promise.resolve({ data: [item], total: 1, page: 1, pageSize: 50 }),
          } as Response);
        }
        if (typeof url === 'string' && url.includes('/mark-reviewed')) {
          return Promise.reject(new Error('API error'));
        }
        return Promise.reject(new Error('Unexpected fetch'));
      }) as unknown as typeof fetch;

      renderActivityList();

      await waitFor(() => expect(screen.getByText(item.pr_title + ' (#' + item.pr_number + ')')).toBeInTheDocument());

      fireEvent.click(screen.getByTitle('Mark as resolved'));

      await waitFor(() => expect(screen.getByText(item.pr_title + ' (#' + item.pr_number + ')')).toBeInTheDocument());
    });
  });

  describe('cleanup', () => {
    it('loads data after StrictMode double-invoke', async () => {
      mockActivityListEndpoint();
      render(
        <ErrorProvider>
          <GlobalErrorBanner />
          <StrictMode>
            <ActivityList schedulerStale={false} lastSchedulerTickAt={null} />
          </StrictMode>
        </ErrorProvider>,
      );
      await waitFor(() => expect(screen.getByText('No activity in this time window.')).toBeInTheDocument());
    });

    it('cleans up intervals on unmount', () => {
      mockActivityListEndpoint();
      const { unmount } = renderActivityList();
      unmount();
    });
  });

  describe('stale banner', () => {
    it('shows stale banner when schedulerStale is true and items are present', async () => {
      const item = makeItem();
      mockActivityListEndpoint({ data: [item], total: 1, page: 1, pageSize: PAGE_SIZE });
      const tickAt = new Date().toISOString();
      render(
        <ErrorProvider>
          <GlobalErrorBanner />
          <ActivityList schedulerStale={true} lastSchedulerTickAt={tickAt} />
        </ErrorProvider>,
      );

      await waitFor(() => expect(screen.getByText(item.pr_title + ' (#' + item.pr_number + ')')).toBeInTheDocument());
      expect(screen.getByText(/Scheduler may be down/)).toBeInTheDocument();
      expect(screen.getByText(/no heartbeat for/)).toBeInTheDocument();
    });

    it('shows "Data refreshed" line when lastUpdatedRef is set', async () => {
      const item = makeItem();
      mockActivityListEndpoint({ data: [item], total: 1, page: 1, pageSize: PAGE_SIZE });
      render(
        <ErrorProvider>
          <GlobalErrorBanner />
          <ActivityList schedulerStale={true} lastSchedulerTickAt={new Date().toISOString()} />
        </ErrorProvider>,
      );

      await waitFor(() => expect(screen.getByText(item.pr_title + ' (#' + item.pr_number + ')')).toBeInTheDocument());
      expect(screen.getByText(/Scheduler may be down/)).toBeInTheDocument();
      expect(screen.getByText(/Data refreshed/)).toBeInTheDocument();
    });

    it('shows "unknown" in stale banner when lastSchedulerTickAt is null', async () => {
      const item = makeItem();
      mockActivityListEndpoint({ data: [item], total: 1, page: 1, pageSize: PAGE_SIZE });
      render(
        <ErrorProvider>
          <GlobalErrorBanner />
          <ActivityList schedulerStale={true} lastSchedulerTickAt={null} />
        </ErrorProvider>,
      );

      await waitFor(() => expect(screen.getByText(/no heartbeat for unknown/)).toBeInTheDocument());
    });

    it('does not show stale banner when schedulerStale is false', async () => {
      const item = makeItem();
      mockActivityListEndpoint({ data: [item], total: 1, page: 1, pageSize: PAGE_SIZE });
      renderActivityList();

      await waitFor(() => expect(screen.getByText(item.pr_title + ' (#' + item.pr_number + ')')).toBeInTheDocument());
      expect(screen.queryByText(/Scheduler may be down/)).not.toBeInTheDocument();
    });

    it('shows stale banner when items are empty and schedulerStale is true', async () => {
      mockActivityListEndpoint();
      render(
        <ErrorProvider>
          <GlobalErrorBanner />
          <ActivityList schedulerStale={true} lastSchedulerTickAt={new Date().toISOString()} />
        </ErrorProvider>,
      );

      await waitFor(() => expect(screen.getByText('No activity in this time window.')).toBeInTheDocument());
      expect(screen.getByText(/Scheduler may be down/)).toBeInTheDocument();
    });

    it('shows stale banner during loading when schedulerStale is true', async () => {
      let resolvePromise!: (value: unknown) => void;
      const promise = new Promise((resolve) => {
        resolvePromise = resolve;
      });
      globalThis.fetch = jest.fn((url: string) => {
        if (typeof url === 'string' && url.includes('/activity-list')) {
          return Promise.resolve({ ok: true, status: StatusCodes.OK, json: () => promise } as Response);
        }
        return Promise.reject(new Error('Unexpected fetch: ' + url));
      }) as unknown as typeof fetch;

      render(
        <ErrorProvider>
          <GlobalErrorBanner />
          <ActivityList schedulerStale={true} lastSchedulerTickAt={new Date().toISOString()} />
        </ErrorProvider>,
      );

      await waitFor(() => expect(screen.getByText('Loading activity list…')).toBeInTheDocument());
      expect(screen.getByText(/Scheduler may be down/)).toBeInTheDocument();

      await act(() => {
        resolvePromise({ data: [], total: EMPTY_TOTAL, page: FIRST_PAGE, pageSize: PAGE_SIZE });
      });
    });
  });

  describe('mark resolved disabled when stale', () => {
    it('disables "Mark as resolved" button when schedulerStale is true', async () => {
      const item = makeItem();
      mockActivityListEndpoint({ data: [item], total: 1, page: 1, pageSize: PAGE_SIZE });
      render(
        <ErrorProvider>
          <GlobalErrorBanner />
          <ActivityList schedulerStale={true} lastSchedulerTickAt={new Date().toISOString()} />
        </ErrorProvider>,
      );

      await waitFor(() => expect(screen.getByText(item.pr_title + ' (#' + item.pr_number + ')')).toBeInTheDocument());
      const button = screen.getByTitle('Unavailable while scheduler is down');
      expect(button).toBeDisabled();
    });

    it('does not disable "Mark as resolved" button when schedulerStale is false', async () => {
      const item = makeItem();
      mockActivityListEndpoint({ data: [item], total: 1, page: 1, pageSize: PAGE_SIZE });
      renderActivityList();

      await waitFor(() => expect(screen.getByText(item.pr_title + ' (#' + item.pr_number + ')')).toBeInTheDocument());
      const button = screen.getByTitle('Mark as resolved');
      expect(button).not.toBeDisabled();
    });
  });
});
