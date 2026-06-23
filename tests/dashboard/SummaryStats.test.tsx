/** @jest-environment jsdom */

import SummaryStats from '../../dashboard/src/components/SummaryStats.js';

import '@testing-library/jest-dom';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { render, screen, waitFor } from '@testing-library/react';

const mockFetch = (status: number, body: unknown) => {
  globalThis.fetch = jest.fn(() =>
    Promise.resolve({
      ok: status < 400,
      status,
      json: () => Promise.resolve(body),
    } as Response),
  ) as jest.Mock;
};

describe('SummaryStats', () => {
  afterEach(() => {
    (globalThis.fetch as jest.Mock).mockRestore?.();
  });

  describe('loading', () => {
    it('shows loading text while fetch is in-flight', () => {
      globalThis.fetch = jest.fn(() => new Promise(() => {})) as jest.Mock;
      render(<SummaryStats />);
      expect(screen.getByText('Loading summary…')).toBeInTheDocument();
    });
  });

  describe('data', () => {
    beforeEach(() => {
      mockFetch(200, {
        queueCounts: { pending: 5, posted: 12, completed: 10, failed: 2 },
        eventCounts24h: { detected: 8, enqueued: 7, posted: 3, rejected: 1, completed: 14, failed: 1 },
        oldestPending: {
          id: 1,
          uuid: 'abc',
          repo_full_name: 'couimet/rabbit-maximizer',
          pr_number: 42,
          status: 'pending',
          scheduled_for: '2026-06-23T14:30:00.000Z',
          attempts: 99,
          source_comment_url: 'https://gh/c/1',
          created_at: '2026-06-22T10:00:00.000Z',
          updated_at: '2026-06-23T12:00:00.000Z',
        },
      });
    });

    it('renders queue count section with correct values', async () => {
      render(<SummaryStats />);
      await waitFor(() => expect(screen.getByText('Queue Counts')).toBeInTheDocument());
      expect(screen.getByText('5')).toBeInTheDocument();
      expect(screen.getByText('12')).toBeInTheDocument();
      expect(screen.getByText('10')).toBeInTheDocument();
      expect(screen.getByText('2')).toBeInTheDocument();
    });

    it('renders event counts from last 24h', async () => {
      render(<SummaryStats />);
      await waitFor(() => expect(screen.getByText('8')).toBeInTheDocument());
      expect(screen.getByText('detected')).toBeInTheDocument();
      expect(screen.getByText('7')).toBeInTheDocument();
      expect(screen.getByText('enqueued')).toBeInTheDocument();
    });

    it('renders the oldest pending item with links', async () => {
      render(<SummaryStats />);
      await waitFor(() => expect(screen.getByText('couimet/rabbit-maximizer')).toBeInTheDocument());
      expect(screen.getByText('#42')).toBeInTheDocument();
      expect(screen.getByText('2026-06-23 14:30:00')).toBeInTheDocument();
      expect(screen.getByText('99')).toBeInTheDocument();

      const repoLink = screen.getByText('couimet/rabbit-maximizer').closest('a');
      expect(repoLink).toHaveAttribute('href', 'https://github.com/couimet/rabbit-maximizer');
      expect(repoLink).toHaveAttribute('target', '_blank');

      const prLink = screen.getByText('#42').closest('a');
      expect(prLink).toHaveAttribute('href', 'https://github.com/couimet/rabbit-maximizer/pull/42');
      expect(prLink).toHaveAttribute('target', '_blank');
    });
  });

  describe('empty', () => {
    it('shows no-pending message when oldestPending is null', async () => {
      mockFetch(200, {
        queueCounts: { pending: 0, posted: 0, completed: 0, failed: 0 },
        eventCounts24h: { detected: 0, enqueued: 0, posted: 0, rejected: 0, completed: 0, failed: 0 },
        oldestPending: null,
      });
      render(<SummaryStats />);
      await waitFor(() => expect(screen.getByText('No pending items.')).toBeInTheDocument());
    });
  });

  describe('cleanup', () => {
    it('cancels in-flight fetch on unmount', () => {
      const { unmount } = render(<SummaryStats />);
      unmount();
      expect(globalThis.fetch).toHaveBeenCalled();
    });
  });

  describe('error', () => {
    it('shows error message on HTTP failure', async () => {
      mockFetch(500, { error: 'Internal server error' });
      render(<SummaryStats />);
      await waitFor(() => expect(screen.getByText('Failed to load summary: Internal server error')).toBeInTheDocument());
    });

    it('shows generic error message when fetch rejects', async () => {
      globalThis.fetch = jest.fn(() => Promise.reject(new Error('Network error'))) as jest.Mock;
      render(<SummaryStats />);
      await waitFor(() => expect(screen.getByText('Failed to load summary: Network error')).toBeInTheDocument());
    });
  });
});
