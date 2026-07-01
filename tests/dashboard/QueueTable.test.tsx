/** @jest-environment jsdom */

import QueueTable from '../../dashboard/src/components/QueueTable.js';
import { TimezoneProvider } from '../../dashboard/src/timezone.js';
import { createMockFetch } from '../helpers/index.js';

import '@testing-library/jest-dom/jest-globals';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

const renderQueueTable = () =>
  render(
    <TimezoneProvider>
      <QueueTable />
    </TimezoneProvider>,
  );

const PAGE_SIZE = 20;

const makeQueueItem = (over: Record<string, unknown> = {}) => ({
  id: 1,
  uuid: 'abc',
  repo_full_name: 'couimet/rabbit-maximizer',
  pr_number: 42,
  status: 'pending',
  scheduled_for: '2026-06-23T14:30:00.000Z',
  attempts: 2,
  source_comment_url: 'https://gh/c/1',
  created_at: '2026-06-22T10:00:00.000Z',
  updated_at: '2026-06-23T12:00:00.000Z',
  ...over,
});

describe('QueueTable', () => {
  afterEach(() => {
    (globalThis.fetch as jest.Mock).mockRestore?.();
    localStorage.clear();
  });

  describe('loading', () => {
    it('shows loading text while fetch is in-flight', () => {
      globalThis.fetch = jest.fn(() => new Promise(() => {})) as unknown as typeof fetch;
      renderQueueTable();
      expect(screen.getByText('Loading queue…')).toBeInTheDocument();
    });
  });

  describe('data', () => {
    beforeEach(() => {
      createMockFetch(200, {
        data: [
          makeQueueItem({
            id: 1,
            status: 'pending',
            repo_full_name: 'couimet/rabbit-maximizer',
            pr_number: 42,
            attempts: 2,
            scheduled_for: '2026-06-23T14:30:00.000Z',
          }),
          makeQueueItem({
            id: 2,
            status: 'posted',
            repo_full_name: 'couimet/ts-npm-packages',
            pr_number: 7,
            attempts: 1,
            scheduled_for: '2026-06-24T09:15:00.000Z',
          }),
        ],
        total: 2,
        page: 1,
        pageSize: PAGE_SIZE,
      });
    });

    it('renders queue items with data and links', async () => {
      renderQueueTable();
      await waitFor(() => expect(screen.getByText('couimet/rabbit-maximizer')).toBeInTheDocument());

      expect(screen.getByText('pending')).toBeInTheDocument();
      expect(screen.getByText('posted')).toBeInTheDocument();
      expect(screen.getByText('couimet/ts-npm-packages')).toBeInTheDocument();
      expect(screen.getByText('#42')).toBeInTheDocument();
      expect(screen.getByText('#7')).toBeInTheDocument();
      expect(screen.getByText('2026-06-23 14:30:00')).toBeInTheDocument();
      expect(screen.getByText('2')).toBeInTheDocument();
    });

    it('renders repo links opening in new tabs', async () => {
      renderQueueTable();
      await waitFor(() => expect(screen.getByText('couimet/rabbit-maximizer')).toBeInTheDocument());
      const link = screen.getByText('couimet/rabbit-maximizer').closest('a');
      expect(link).toHaveAttribute('href', 'https://github.com/couimet/rabbit-maximizer');
      expect(link).toHaveAttribute('target', '_blank');
    });

    it('renders PR links opening in new tabs', async () => {
      renderQueueTable();
      await waitFor(() => expect(screen.getByText('#42')).toBeInTheDocument());
      const link = screen.getByText('#42').closest('a');
      expect(link).toHaveAttribute('href', 'https://github.com/couimet/rabbit-maximizer/pull/42');
      expect(link).toHaveAttribute('target', '_blank');
    });
  });

  describe('empty', () => {
    it('shows empty message when no queue items exist', async () => {
      createMockFetch(200, { data: [], total: 0, page: 1, pageSize: PAGE_SIZE });
      renderQueueTable();
      await waitFor(() => expect(screen.getByText('No queue items.')).toBeInTheDocument());
    });
  });

  describe('pagination', () => {
    it('fetches with page number and disables Previous on first page', async () => {
      createMockFetch(200, { data: [makeQueueItem()], total: 1, page: 1, pageSize: PAGE_SIZE });
      renderQueueTable();
      await waitFor(() => expect(screen.getByText('#42')).toBeInTheDocument());
      expect(screen.getByText('Previous').closest('button')).toBeDisabled();
    });

    it('disables Next on last page', async () => {
      createMockFetch(200, { data: [makeQueueItem()], total: 1, page: 1, pageSize: PAGE_SIZE });
      renderQueueTable();
      await waitFor(() => expect(screen.getByText('#42')).toBeInTheDocument());
      expect(screen.getByText('Next').closest('button')).toBeDisabled();
    });

    it('fetches next page when Next is clicked', async () => {
      createMockFetch(200, { data: [makeQueueItem()], total: 50, page: 1, pageSize: PAGE_SIZE });
      renderQueueTable();
      await waitFor(() => expect(screen.getByText('#42')).toBeInTheDocument());

      createMockFetch(200, { data: [makeQueueItem({ id: 99, pr_number: 99 })], total: 50, page: 2, pageSize: PAGE_SIZE });
      fireEvent.click(screen.getByText('Next'));
      await waitFor(() => expect(screen.getByText('#99')).toBeInTheDocument());
    });

    it('fetches previous page when Previous is clicked', async () => {
      createMockFetch(200, { data: [makeQueueItem({ pr_number: 50 })], total: 50, page: 1, pageSize: PAGE_SIZE });
      renderQueueTable();
      await waitFor(() => expect(screen.getByText('#50')).toBeInTheDocument());

      createMockFetch(200, { data: [makeQueueItem({ pr_number: 51 })], total: 50, page: 2, pageSize: PAGE_SIZE });
      fireEvent.click(screen.getByText('Next'));
      await waitFor(() => expect(screen.getByText('#51')).toBeInTheDocument());

      createMockFetch(200, { data: [makeQueueItem({ id: 1, pr_number: 1 })], total: 50, page: 1, pageSize: PAGE_SIZE });
      fireEvent.click(screen.getByText('Previous'));
      await waitFor(() => expect(screen.getByText('#1')).toBeInTheDocument());
    });
  });

  describe('cleanup', () => {
    it('cancels in-flight fetch on unmount', () => {
      const { unmount } = renderQueueTable();
      unmount();
      expect(globalThis.fetch).toHaveBeenCalled();
    });
  });

  describe('error', () => {
    it('shows error message on HTTP failure', async () => {
      createMockFetch(500, { error: 'Internal server error' });
      renderQueueTable();
      await waitFor(() => expect(screen.getByText('Failed to load queue: Internal server error')).toBeInTheDocument());
    });
  });

  describe('timezone', () => {
    beforeEach(() => {
      localStorage.setItem('rm-timezone', 'America/New_York');
      createMockFetch(200, {
        data: [makeQueueItem({ id: 1, scheduled_for: '2026-06-23T14:30:00.000Z' })],
        total: 1,
        page: 1,
        pageSize: PAGE_SIZE,
      });
    });

    it('renders column header without timezone suffix for non-UTC', async () => {
      renderQueueTable();
      await waitFor(() => expect(screen.getByText('Scheduled For')).toBeInTheDocument());
    });

    it('formats dates in the selected timezone', async () => {
      renderQueueTable();
      await waitFor(() => expect(screen.getByText('2026-06-23 10:30:00')).toBeInTheDocument());
    });
  });
});
