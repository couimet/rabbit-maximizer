/** @jest-environment jsdom */

import QueueOrder from '../../dashboard/src/components/QueueOrder.js';
import { createMockFetch } from '../helpers/index.js';

import '@testing-library/jest-dom/jest-globals';
import { getUniqueDate, getUniqueInt, getUniqueString } from '@couimet/dynamic-testing';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

const defaultOnMoveComplete = jest.fn();

const renderQueueOrder = (items: ReturnType<typeof makeQueueItem>[] | null = null, error: string | null = null, onMoveComplete = defaultOnMoveComplete) =>
  render(<QueueOrder items={items} error={error} onMoveComplete={onMoveComplete} headingLevel="h2" pendingCount={null} />);

const makeQueueItem = (over: Record<string, unknown> = {}) => ({
  id: getUniqueInt(),
  uuid: getUniqueString({ prefix: 'uuid-' }),
  repo_full_name: `${getUniqueString({ prefix: 'owner' })}/${getUniqueString({ prefix: 'repo' })}`,
  pr_number: getUniqueInt(),
  status: 'pending' as const,
  not_before: getUniqueDate().toISOString(),
  attempts: getUniqueInt(),
  source_comment_url: getUniqueString({ prefix: 'https://gh/c/' }),
  created_at: getUniqueDate().toISOString(),
  updated_at: getUniqueDate().toISOString(),
  ...over,
});

describe('QueueOrder', () => {
  afterEach(() => {
    localStorage.clear();
  });

  describe('loading', () => {
    it('shows loading text when items is null', () => {
      renderQueueOrder(null);
      expect(screen.getByText('Loading queue order…')).toBeInTheDocument();
    });
  });

  describe('data', () => {
    let item1: ReturnType<typeof makeQueueItem>;
    let item2: ReturnType<typeof makeQueueItem>;

    beforeEach(() => {
      item1 = makeQueueItem();
      item2 = makeQueueItem();
    });

    it('renders queue order items with position numbers and details', () => {
      renderQueueOrder([item1, item2]);

      expect(screen.getByText('1')).toBeInTheDocument();
      expect(screen.getByText('2')).toBeInTheDocument();
      expect(screen.getByText(item1.repo_full_name)).toBeInTheDocument();
      expect(screen.getByText(item2.repo_full_name)).toBeInTheDocument();
      expect(screen.getByText(`#${item1.pr_number}`)).toBeInTheDocument();
      expect(screen.getByText(`#${item2.pr_number}`)).toBeInTheDocument();
    });

    it('renders repo links opening in new tabs', () => {
      renderQueueOrder([item1, item2]);
      const link = screen.getByText(item1.repo_full_name).closest('a');
      expect(link).toHaveAttribute('href', `https://github.com/${item1.repo_full_name}`);
      expect(link).toHaveAttribute('target', '_blank');
    });

    it('renders PR links opening in new tabs', () => {
      renderQueueOrder([item1, item2]);
      const link = screen.getByText(`#${item1.pr_number}`).closest('a');
      expect(link).toHaveAttribute('href', `https://github.com/${item1.repo_full_name}/pull/${item1.pr_number}`);
      expect(link).toHaveAttribute('target', '_blank');
    });

    it('includes pending count in heading when pendingCount is provided', () => {
      render(<QueueOrder items={[makeQueueItem()]} error={null} onMoveComplete={jest.fn()} headingLevel="h2" pendingCount={3} />);
      expect(screen.getByText('Queue Order — 3 pending item(s)')).toBeInTheDocument();
    });

    it('renders up and down arrow buttons per row', () => {
      renderQueueOrder([item1, item2]);
      const upButtons = screen.getAllByLabelText('Move up');
      const downButtons = screen.getAllByLabelText('Move down');
      expect(upButtons).toHaveLength(2);
      expect(downButtons).toHaveLength(2);
    });
  });

  describe('empty', () => {
    it('shows empty message when items is empty', () => {
      renderQueueOrder([]);
      expect(screen.getByText('No pending items.')).toBeInTheDocument();
    });
  });

  describe('error', () => {
    it('shows error message when error prop is set', () => {
      renderQueueOrder(null, 'Internal server error');
      expect(screen.getByText('Failed to load queue order: Internal server error')).toBeInTheDocument();
    });
  });

  describe('cleanup', () => {
    it('does not update state after unmount when move request resolves', async () => {
      const items = [makeQueueItem(), makeQueueItem()];

      let resolveMove!: (value: { data: ReturnType<typeof makeQueueItem>[] }) => void;
      const movePromise = new Promise<{ data: ReturnType<typeof makeQueueItem>[] }>((resolve) => {
        resolveMove = resolve;
      });
      globalThis.fetch = jest.fn(() =>
        Promise.resolve({
          ok: true,
          status: 200,
          json: () => movePromise,
        } as Response),
      ) as unknown as typeof fetch;

      const { unmount } = renderQueueOrder(items);
      fireEvent.click(screen.getAllByLabelText('Move up')[0]);
      unmount();

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      resolveMove({ data: [makeQueueItem(), makeQueueItem()] });
      await new Promise((r) => setTimeout(r, 0));

      const stateUpdateWarnings = consoleErrorSpy.mock.calls.filter((call) => typeof call[0] === 'string' && (call[0] as string).includes('unmounted'));
      expect(stateUpdateWarnings).toHaveLength(0);
    });

    it('does not update state after unmount when move request fails', async () => {
      const items = [makeQueueItem(), makeQueueItem()];

      let rejectMove!: (reason: Error) => void;
      const moveFetchPromise = new Promise<Response>((_, reject) => {
        rejectMove = reject;
      });
      globalThis.fetch = jest.fn(() => moveFetchPromise) as unknown as typeof fetch;

      const { unmount } = renderQueueOrder(items);
      fireEvent.click(screen.getAllByLabelText('Move up')[0]);
      unmount();

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      rejectMove(new Error('Network error'));
      await new Promise((r) => setTimeout(r, 0));

      const stateUpdateWarnings = consoleErrorSpy.mock.calls.filter((call) => typeof call[0] === 'string' && (call[0] as string).includes('unmounted'));
      expect(stateUpdateWarnings).toHaveLength(0);
    });
  });

  describe('select all', () => {
    const items = [makeQueueItem(), makeQueueItem()];

    it('selects all items when header checkbox is clicked', () => {
      renderQueueOrder([...items]);
      const checkboxes = screen.getAllByRole('checkbox');
      fireEvent.click(checkboxes[0]);

      expect(checkboxes[0]).toBeChecked();
      expect(checkboxes[1]).toBeChecked();
      expect(checkboxes[2]).toBeChecked();
    });

    it('deselects all when header checkbox is clicked twice', () => {
      renderQueueOrder([...items]);
      const checkboxes = screen.getAllByRole('checkbox');
      fireEvent.click(checkboxes[0]);
      fireEvent.click(checkboxes[0]);

      expect(checkboxes[0]).not.toBeChecked();
      expect(checkboxes[1]).not.toBeChecked();
      expect(checkboxes[2]).not.toBeChecked();
    });

    it('toggles individual item selection on checkbox click', () => {
      renderQueueOrder([...items]);
      const checkboxes = screen.getAllByRole('checkbox');
      fireEvent.click(checkboxes[1]);
      expect(checkboxes[1]).toBeChecked();
      fireEvent.click(checkboxes[1]);
      expect(checkboxes[1]).not.toBeChecked();
    });
  });

  describe('move actions', () => {
    let item1: ReturnType<typeof makeQueueItem>;
    let item2: ReturnType<typeof makeQueueItem>;
    let onMoveComplete: jest.Mock;

    beforeEach(() => {
      item1 = makeQueueItem();
      item2 = makeQueueItem();
      onMoveComplete = jest.fn();
    });

    const moveResponse = () => ({ data: [makeQueueItem(), makeQueueItem()] });

    it('calls moveQueueItems with correct args on single up click', async () => {
      createMockFetch(200, moveResponse());
      renderQueueOrder([item1, item2], null, onMoveComplete);

      fireEvent.click(screen.getAllByLabelText('Move up')[0]);

      await waitFor(() => {
        expect(globalThis.fetch).toHaveBeenCalledWith('/api/queue/order/move', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ queueItemIds: [item1.id], direction: 'up' }),
        });
      });
    });

    it('calls onMoveComplete after successful move', async () => {
      createMockFetch(200, moveResponse());
      renderQueueOrder([item1, item2], null, onMoveComplete);

      fireEvent.click(screen.getAllByLabelText('Move up')[0]);

      await waitFor(() => {
        expect(onMoveComplete).toHaveBeenCalled();
      });
    });

    it('calls moveQueueItems with correct args on single down click', async () => {
      createMockFetch(200, moveResponse());
      renderQueueOrder([item1, item2], null, onMoveComplete);

      fireEvent.click(screen.getAllByLabelText('Move down')[1]);

      await waitFor(() => {
        expect(globalThis.fetch).toHaveBeenCalledWith('/api/queue/order/move', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ queueItemIds: [item2.id], direction: 'down' }),
        });
      });
    });

    it('moves selected items on Move Up toolbar click', async () => {
      createMockFetch(200, moveResponse());
      renderQueueOrder([item1, item2], null, onMoveComplete);

      const checkboxes = screen.getAllByRole('checkbox');
      fireEvent.click(checkboxes[1]);
      fireEvent.click(checkboxes[2]);

      fireEvent.click(screen.getByText('Move Up'));

      await waitFor(() => {
        expect(globalThis.fetch).toHaveBeenCalledWith('/api/queue/order/move', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ queueItemIds: [item1.id, item2.id], direction: 'up' }),
        });
      });
    });

    it('moves selected items on Move Down toolbar click', async () => {
      createMockFetch(200, moveResponse());
      renderQueueOrder([item1, item2], null, onMoveComplete);

      const checkboxes = screen.getAllByRole('checkbox');
      fireEvent.click(checkboxes[1]);

      fireEvent.click(screen.getByText('Move Down'));

      await waitFor(() => {
        expect(globalThis.fetch).toHaveBeenCalledWith('/api/queue/order/move', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ queueItemIds: [item1.id], direction: 'down' }),
        });
      });
    });

    it('shows error message when move request fails', async () => {
      renderQueueOrder([item1, item2], null, onMoveComplete);

      createMockFetch(500, { error: 'Server error' });
      fireEvent.click(screen.getAllByLabelText('Move up')[0]);

      await waitFor(() => expect(screen.getByText('Move failed: Server error')).toBeInTheDocument());
    });

    it('shows error message when response data is not an array', async () => {
      renderQueueOrder([item1, item2], null, onMoveComplete);

      createMockFetch(200, { data: null });
      fireEvent.click(screen.getAllByLabelText('Move up')[0]);

      await waitFor(() => expect(screen.getByText('Move failed: Unexpected response from server')).toBeInTheDocument());
    });
  });

  describe('not_before display', () => {
    it('renders column header', () => {
      renderQueueOrder([makeQueueItem({ not_before: new Date(Date.now() + 300_000).toISOString() })]);
      expect(screen.getByText('Not Before')).toBeInTheDocument();
    });

    it('shows eligible now for not_before in the past', () => {
      renderQueueOrder([makeQueueItem({ not_before: new Date(Date.now() - 60_000).toISOString() })]);
      expect(screen.getByText('eligible now')).toBeInTheDocument();
    });
  });
});
