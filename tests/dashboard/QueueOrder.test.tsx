/** @jest-environment jsdom */

import QueueOrder from '../../dashboard/src/components/QueueOrder.js';
import { createMockFetch } from '../helpers/index.js';

import '@testing-library/jest-dom/jest-globals';
import { getUniqueDate, getUniqueInt, getUniqueString } from '@couimet/dynamic-testing';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

const renderQueueOrder = () => render(<QueueOrder />);

const makeQueueItem = (over: Record<string, unknown> = {}) => ({
  id: getUniqueInt(),
  uuid: getUniqueString({ prefix: 'uuid-' }),
  repo_full_name: `${getUniqueString({ prefix: 'owner' })}/${getUniqueString({ prefix: 'repo' })}`,
  pr_number: getUniqueInt(),
  status: 'pending',
  not_before: getUniqueDate().toISOString(),
  attempts: getUniqueInt(),
  source_comment_url: getUniqueString({ prefix: 'https://gh/c/' }),
  created_at: getUniqueDate().toISOString(),
  updated_at: getUniqueDate().toISOString(),
  ...over,
});

describe('QueueOrder', () => {
  afterEach(() => {
    (globalThis.fetch as jest.Mock).mockRestore?.();
    localStorage.clear();
  });

  describe('loading', () => {
    it('shows loading text while fetch is in-flight', () => {
      globalThis.fetch = jest.fn(() => new Promise(() => {})) as unknown as typeof fetch;
      renderQueueOrder();
      expect(screen.getByText('Loading queue order…')).toBeInTheDocument();
    });
  });

  describe('data', () => {
    let item1: ReturnType<typeof makeQueueItem>;
    let item2: ReturnType<typeof makeQueueItem>;

    beforeEach(() => {
      item1 = makeQueueItem({ status: 'pending' });
      item2 = makeQueueItem({ status: 'pending' });
      createMockFetch(200, { data: [item1, item2] });
    });

    it('renders queue order items with position numbers and details', async () => {
      renderQueueOrder();
      await waitFor(() => expect(screen.getByText('1')).toBeInTheDocument());

      expect(screen.getByText('2')).toBeInTheDocument();
      expect(screen.getAllByText('pending')).toHaveLength(2);
      expect(screen.getByText(item1.repo_full_name)).toBeInTheDocument();
      expect(screen.getByText(item2.repo_full_name)).toBeInTheDocument();
      expect(screen.getByText(`#${item1.pr_number}`)).toBeInTheDocument();
      expect(screen.getByText(`#${item2.pr_number}`)).toBeInTheDocument();
    });

    it('renders repo links opening in new tabs', async () => {
      renderQueueOrder();
      await waitFor(() => expect(screen.getByText(item1.repo_full_name)).toBeInTheDocument());
      const link = screen.getByText(item1.repo_full_name).closest('a');
      expect(link).toHaveAttribute('href', `https://github.com/${item1.repo_full_name}`);
      expect(link).toHaveAttribute('target', '_blank');
    });

    it('renders PR links opening in new tabs', async () => {
      renderQueueOrder();
      await waitFor(() => expect(screen.getByText(`#${item1.pr_number}`)).toBeInTheDocument());
      const link = screen.getByText(`#${item1.pr_number}`).closest('a');
      expect(link).toHaveAttribute('href', `https://github.com/${item1.repo_full_name}/pull/${item1.pr_number}`);
      expect(link).toHaveAttribute('target', '_blank');
    });

    it('renders up and down arrow buttons per row', async () => {
      renderQueueOrder();
      await waitFor(() => expect(screen.getByText('1')).toBeInTheDocument());
      const upButtons = screen.getAllByLabelText('Move up');
      const downButtons = screen.getAllByLabelText('Move down');
      expect(upButtons).toHaveLength(2);
      expect(downButtons).toHaveLength(2);
    });
  });

  describe('empty', () => {
    it('shows empty message when no pending items', async () => {
      createMockFetch(200, { data: [] });
      renderQueueOrder();
      await waitFor(() => expect(screen.getByText('No pending items.')).toBeInTheDocument());
    });
  });

  describe('error', () => {
    it('shows error message on HTTP failure', async () => {
      createMockFetch(500, { error: 'Internal server error' });
      renderQueueOrder();
      await waitFor(() => expect(screen.getByText('Failed to load queue order: Internal server error')).toBeInTheDocument());
    });
  });

  describe('cleanup', () => {
    it('does not update state after unmount when fetch resolves', async () => {
      let resolvePromise!: (value: { data: ReturnType<typeof makeQueueItem>[] }) => void;
      const fetchPromise = new Promise<{ data: ReturnType<typeof makeQueueItem>[] }>((resolve) => {
        resolvePromise = resolve;
      });
      globalThis.fetch = jest.fn(() =>
        Promise.resolve({
          ok: true,
          status: 200,
          json: () => fetchPromise,
        } as Response),
      ) as unknown as typeof fetch;

      const { unmount } = renderQueueOrder();
      unmount();

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      resolvePromise({ data: [makeQueueItem(), makeQueueItem()] });
      await new Promise((r) => setTimeout(r, 0));

      const stateUpdateWarnings = consoleErrorSpy.mock.calls.filter((call) => typeof call[0] === 'string' && (call[0] as string).includes('unmounted'));
      expect(stateUpdateWarnings).toHaveLength(0);
    });

    it('does not update state after unmount when move request resolves', async () => {
      createMockFetch(200, { data: [makeQueueItem(), makeQueueItem()] });
      const { unmount } = renderQueueOrder();
      await waitFor(() => expect(screen.getByText('1')).toBeInTheDocument());

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

      fireEvent.click(screen.getAllByLabelText('Move up')[0]);
      unmount();

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      resolveMove({ data: [makeQueueItem(), makeQueueItem()] });
      await new Promise((r) => setTimeout(r, 0));

      const stateUpdateWarnings = consoleErrorSpy.mock.calls.filter((call) => typeof call[0] === 'string' && (call[0] as string).includes('unmounted'));
      expect(stateUpdateWarnings).toHaveLength(0);
    });

    it('does not update state after unmount when move request fails', async () => {
      createMockFetch(200, { data: [makeQueueItem(), makeQueueItem()] });
      const { unmount } = renderQueueOrder();
      await waitFor(() => expect(screen.getByText('1')).toBeInTheDocument());

      let rejectMove!: (reason: Error) => void;
      const moveFetchPromise = new Promise<Response>((_, reject) => {
        rejectMove = reject;
      });
      globalThis.fetch = jest.fn(() => moveFetchPromise) as unknown as typeof fetch;

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
    beforeEach(() => {
      createMockFetch(200, {
        data: [makeQueueItem(), makeQueueItem()],
      });
    });

    it('selects all items when header checkbox is clicked', async () => {
      renderQueueOrder();
      await waitFor(() => expect(screen.getByText('1')).toBeInTheDocument());

      const checkboxes = screen.getAllByRole('checkbox');
      const headerCheckbox = checkboxes[0];
      fireEvent.click(headerCheckbox);

      expect(checkboxes[0]).toBeChecked();
      expect(checkboxes[1]).toBeChecked();
      expect(checkboxes[2]).toBeChecked();
    });

    it('deselects all when header checkbox is clicked twice', async () => {
      renderQueueOrder();
      await waitFor(() => expect(screen.getByText('1')).toBeInTheDocument());

      const checkboxes = screen.getAllByRole('checkbox');
      fireEvent.click(checkboxes[0]);
      fireEvent.click(checkboxes[0]);

      expect(checkboxes[0]).not.toBeChecked();
      expect(checkboxes[1]).not.toBeChecked();
      expect(checkboxes[2]).not.toBeChecked();
    });

    it('toggles individual item selection on checkbox click', async () => {
      renderQueueOrder();
      await waitFor(() => expect(screen.getByText('1')).toBeInTheDocument());

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

    beforeEach(() => {
      item1 = makeQueueItem();
      item2 = makeQueueItem();
      createMockFetch(200, { data: [item1, item2] });
    });

    const moveResponse = () => ({ data: [makeQueueItem(), makeQueueItem()] });

    it('calls moveQueueItems with correct args on single up click', async () => {
      renderQueueOrder();
      await waitFor(() => expect(screen.getByText('1')).toBeInTheDocument());

      createMockFetch(200, moveResponse());
      fireEvent.click(screen.getAllByLabelText('Move up')[0]);

      await waitFor(() => {
        expect(globalThis.fetch).toHaveBeenCalledWith('/api/queue/order/move', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ queueItemIds: [item1.id], direction: 'up' }),
        });
      });
    });

    it('calls moveQueueItems with correct args on single down click', async () => {
      renderQueueOrder();
      await waitFor(() => expect(screen.getByText('1')).toBeInTheDocument());

      createMockFetch(200, moveResponse());
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
      renderQueueOrder();
      await waitFor(() => expect(screen.getByText('1')).toBeInTheDocument());

      const checkboxes = screen.getAllByRole('checkbox');
      fireEvent.click(checkboxes[1]); // select first row
      fireEvent.click(checkboxes[2]); // select second row

      createMockFetch(200, moveResponse());
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
      renderQueueOrder();
      await waitFor(() => expect(screen.getByText('1')).toBeInTheDocument());

      const checkboxes = screen.getAllByRole('checkbox');
      fireEvent.click(checkboxes[1]);

      createMockFetch(200, moveResponse());
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
      renderQueueOrder();
      await waitFor(() => expect(screen.getByText('1')).toBeInTheDocument());

      createMockFetch(500, { error: 'Server error' });
      fireEvent.click(screen.getAllByLabelText('Move up')[0]);

      await waitFor(() => expect(screen.getByText('Move failed: Server error')).toBeInTheDocument());
    });

    it('shows error message when response data is not an array', async () => {
      renderQueueOrder();
      await waitFor(() => expect(screen.getByText('1')).toBeInTheDocument());

      createMockFetch(200, { data: null });
      fireEvent.click(screen.getAllByLabelText('Move up')[0]);

      await waitFor(() => expect(screen.getByText('Move failed: Unexpected response from server')).toBeInTheDocument());
    });
  });

  describe('not_before display', () => {
    it('renders column header', async () => {
      createMockFetch(200, {
        data: [makeQueueItem({ not_before: new Date(Date.now() + 300_000).toISOString() })],
      });
      renderQueueOrder();
      await waitFor(() => expect(screen.getByText('Not Before')).toBeInTheDocument());
    });

    it('shows eligible now for not_before in the past', async () => {
      createMockFetch(200, {
        data: [makeQueueItem({ not_before: new Date(Date.now() - 60_000).toISOString() })],
      });
      renderQueueOrder();
      await waitFor(() => expect(screen.getByText('eligible now')).toBeInTheDocument());
    });
  });
});
