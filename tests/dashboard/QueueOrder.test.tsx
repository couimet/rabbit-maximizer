/** @jest-environment jsdom */

import QueueOrder from '../../dashboard/src/components/QueueOrder.js';
import { QueueStatus, TriggerSource } from '../../src/types/index.js';
import { createMockFetch } from '../helpers/index.js';

import '@testing-library/jest-dom/jest-globals';
import { getUniqueDate, getUniqueInt, getUniqueString } from '@couimet/dynamic-testing';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { StrictMode } from 'react';

const defaultOnMoveComplete = jest.fn();

const renderQueueOrder = (
  items: ReturnType<typeof makeQueueItem>[] | null = null,
  error: string | null = null,
  onMoveComplete = defaultOnMoveComplete,
  paused = false,
) => render(<QueueOrder items={items} error={error} onMoveComplete={onMoveComplete} headingLevel="h2" pendingCount={null} paused={paused} />);

const makeQueueItem = (over: Record<string, unknown> = {}) => ({
  id: getUniqueInt(),
  uuid: getUniqueString({ prefix: 'uuid-' }),
  repo_full_name: `${getUniqueString({ prefix: 'owner' })}/${getUniqueString({ prefix: 'repo' })}`,
  pr_number: getUniqueInt(),
  pr_title: getUniqueString({ prefix: 'pr-' }),
  status: QueueStatus.pending,
  not_before: getUniqueDate().toISOString(),
  attempts: getUniqueInt(),
  source_comment_url: getUniqueString({ prefix: 'https://gh/c/' }),
  trigger_source: TriggerSource.scheduler,
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
      expect(screen.getByText(item1.pr_title)).toBeInTheDocument();
      expect(screen.getByText(item2.pr_title)).toBeInTheDocument();
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
      render(<QueueOrder items={[makeQueueItem()]} error={null} onMoveComplete={jest.fn()} headingLevel="h2" pendingCount={3} paused={false} />);
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

    it('allows move after StrictMode double-invoke', async () => {
      const items = [makeQueueItem(), makeQueueItem()];
      const onMoveComplete = jest.fn();

      globalThis.fetch = jest.fn(() =>
        Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ data: [makeQueueItem(), makeQueueItem()] }),
        } as Response),
      ) as unknown as typeof fetch;

      render(
        <StrictMode>
          <QueueOrder items={items} error={null} onMoveComplete={onMoveComplete} headingLevel="h2" pendingCount={null} paused={false} />
        </StrictMode>,
      );

      fireEvent.click(screen.getAllByLabelText('Move up')[0]);

      await waitFor(() => {
        expect(onMoveComplete).toHaveBeenCalled();
      });
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
          body: JSON.stringify({ queueItemUuids: [item1.uuid], direction: 'up' }),
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
          body: JSON.stringify({ queueItemUuids: [item2.uuid], direction: 'down' }),
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
          body: JSON.stringify({ queueItemUuids: [item1.uuid, item2.uuid], direction: 'up' }),
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
          body: JSON.stringify({ queueItemUuids: [item1.uuid], direction: 'down' }),
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
      expect(screen.getAllByText('eligible now').length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Status column', () => {
    const PAST_NOT_BEFORE_ISO = new Date(Date.now() - 60_000).toISOString();
    const FUTURE_NOT_BEFORE_ISO = new Date(Date.now() + 300_000).toISOString();

    it('renders Status column header', () => {
      renderQueueOrder([makeQueueItem()]);
      expect(screen.getByText('Status')).toBeInTheDocument();
    });

    it('shows green Eligible now pill for position 1 when not_before is in the past', () => {
      renderQueueOrder([makeQueueItem({ not_before: PAST_NOT_BEFORE_ISO })]);
      const pill = document.querySelector('.status-pill.eligible');
      expect(pill).not.toBeNull();
      expect(pill!.textContent).toBe('eligible now');
    });

    it('shows orange cooldown pill for position 1 when not_before is in the future', () => {
      renderQueueOrder([makeQueueItem({ not_before: FUTURE_NOT_BEFORE_ISO })]);
      const pill = document.querySelector('.status-pill.cooldown');
      expect(pill).not.toBeNull();
      expect(pill!.textContent).toMatch(/^in \d+m$/);
    });

    it('shows one carrot for position 2', () => {
      renderQueueOrder([makeQueueItem(), makeQueueItem()]);
      const rows = screen.getAllByRole('row');
      expect(rows[2]).toHaveTextContent('🥕');
    });

    it('shows two carrots for position 3', () => {
      renderQueueOrder([makeQueueItem(), makeQueueItem(), makeQueueItem()]);
      const rows = screen.getAllByRole('row');
      expect(rows[3]).toHaveTextContent('🥕🥕');
    });

    it('applies row-waiting class to positions greater than 1', () => {
      renderQueueOrder([makeQueueItem(), makeQueueItem()]);
      const rows = screen.getAllByRole('row');
      expect(rows[2].classList.contains('row-waiting')).toBe(true);
    });

    it('does not apply row-waiting class to position 1', () => {
      renderQueueOrder([makeQueueItem(), makeQueueItem()]);
      const rows = screen.getAllByRole('row');
      expect(rows[1].classList.contains('row-waiting')).toBe(false);
    });

    it('shows pill with no carrots for single item', () => {
      renderQueueOrder([makeQueueItem({ not_before: PAST_NOT_BEFORE_ISO })]);
      expect(document.querySelector('.status-pill')).not.toBeNull();
      expect(screen.queryByText('🥕')).not.toBeInTheDocument();
    });
  });

  describe('retrigger now', () => {
    let item1: ReturnType<typeof makeQueueItem>;
    let item2: ReturnType<typeof makeQueueItem>;
    let onMoveComplete: jest.Mock;

    beforeEach(() => {
      item1 = makeQueueItem();
      item2 = makeQueueItem();
      onMoveComplete = jest.fn();
    });

    it('renders lightning-bolt button per row', () => {
      renderQueueOrder([item1, item2]);

      const buttons = screen.getAllByLabelText(/^Retrigger now/);
      expect(buttons).toHaveLength(2);
    });

    it('calls retriggerNow API on click', async () => {
      createMockFetch(204, undefined);
      renderQueueOrder([item1, item2], null, onMoveComplete);

      fireEvent.click(screen.getAllByLabelText(/^Retrigger now/)[0]);

      await waitFor(() => {
        expect(globalThis.fetch).toHaveBeenCalledWith('/api/queue/' + item1.uuid + '/retrigger-now', {
          method: 'POST',
        });
      });
    });

    it('shows success toast with interval on success', async () => {
      createMockFetch(204, undefined);
      renderQueueOrder([item1, item2], null, onMoveComplete);

      fireEvent.click(screen.getAllByLabelText(/^Retrigger now/)[0]);

      await waitFor(() => {
        expect(screen.getByText('Retrigger requested')).toBeInTheDocument();
      });
    });

    it('shows error toast on failure', async () => {
      createMockFetch(500, { error: 'Rate limited' });
      renderQueueOrder([item1, item2], null, onMoveComplete);

      fireEvent.click(screen.getAllByLabelText(/^Retrigger now/)[0]);

      await waitFor(() => {
        expect(screen.getByText('Rate limited')).toBeInTheDocument();
      });
    });

    it('button disabled while request in flight', async () => {
      let resolveRetrigger!: (value: void | PromiseLike<void>) => void;
      const retriggerPromise = new Promise<void>((resolve) => {
        resolveRetrigger = resolve;
      });
      globalThis.fetch = jest.fn(() =>
        Promise.resolve({
          ok: true,
          status: 200,
          json: () => retriggerPromise,
        } as Response),
      ) as unknown as typeof fetch;

      renderQueueOrder([item1, item2], null, onMoveComplete);
      fireEvent.click(screen.getAllByLabelText(/^Retrigger now/)[0]);

      await waitFor(() => {
        expect(screen.getAllByLabelText(/^Retrigger now/)[0]).toBeDisabled();
      });

      resolveRetrigger();

      await waitFor(() => {
        expect(screen.getByText('Retrigger requested')).toBeInTheDocument();
      });
    });

    it('calls onMoveComplete on success', async () => {
      createMockFetch(204, undefined);
      renderQueueOrder([item1, item2], null, onMoveComplete);

      fireEvent.click(screen.getAllByLabelText(/^Retrigger now/)[0]);

      await waitFor(() => {
        expect(onMoveComplete).toHaveBeenCalled();
      });
    });

    it('does not update state after unmount on success', async () => {
      let resolveRetrigger!: (value: void | PromiseLike<void>) => void;
      const retriggerPromise = new Promise<void>((resolve) => {
        resolveRetrigger = resolve;
      });
      globalThis.fetch = jest.fn(() =>
        Promise.resolve({
          ok: true,
          status: 200,
          json: () => retriggerPromise,
        } as Response),
      ) as unknown as typeof fetch;

      const { unmount } = renderQueueOrder([item1, item2], null, onMoveComplete);
      fireEvent.click(screen.getAllByLabelText(/^Retrigger now/)[0]);
      unmount();

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      resolveRetrigger();
      await new Promise((r) => setTimeout(r, 0));

      const stateUpdateWarnings = consoleErrorSpy.mock.calls.filter((call) => typeof call[0] === 'string' && (call[0] as string).includes('unmounted'));
      expect(stateUpdateWarnings).toHaveLength(0);
    });

    it('does not update state after unmount on error', async () => {
      let rejectRetrigger!: (reason: Error) => void;
      const retriggerFetchPromise = new Promise<Response>((_, reject) => {
        rejectRetrigger = reject;
      });
      globalThis.fetch = jest.fn(() => retriggerFetchPromise) as unknown as typeof fetch;

      const { unmount } = renderQueueOrder([item1, item2], null, onMoveComplete);
      fireEvent.click(screen.getAllByLabelText(/^Retrigger now/)[0]);
      unmount();

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      rejectRetrigger(new Error('Network error'));
      await new Promise((r) => setTimeout(r, 0));

      const stateUpdateWarnings = consoleErrorSpy.mock.calls.filter((call) => typeof call[0] === 'string' && (call[0] as string).includes('unmounted'));
      expect(stateUpdateWarnings).toHaveLength(0);
    });

    it('retrigger buttons are enabled when paused is false', () => {
      const items = [makeQueueItem()];
      render(<QueueOrder items={items} error={null} onMoveComplete={jest.fn()} headingLevel="h2" pendingCount={null} paused={false} />);

      expect(screen.getByLabelText(/^Retrigger now/)).not.toBeDisabled();
    });

    it('retrigger buttons are enabled when paused is true', () => {
      const items = [makeQueueItem()];
      render(<QueueOrder items={items} error={null} onMoveComplete={jest.fn()} headingLevel="h2" pendingCount={null} paused={true} />);

      expect(screen.getByLabelText(/^Retrigger now/)).not.toBeDisabled();
    });

    it('shows confirmation dialog when retrigger is clicked while paused', () => {
      const items = [makeQueueItem()];
      render(<QueueOrder items={items} error={null} onMoveComplete={jest.fn()} headingLevel="h2" pendingCount={null} paused={true} />);

      fireEvent.click(screen.getByLabelText(/^Retrigger now/));

      expect(screen.getByText(/scheduler is currently paused. Retrigger anyway/)).toBeInTheDocument();
      expect(screen.getByText('Retrigger anyway')).toBeInTheDocument();
    });

    it('confirming the dialog calls retriggerNow with overridePause=true', async () => {
      createMockFetch(204, undefined);
      const items = [makeQueueItem()];
      render(<QueueOrder items={items} error={null} onMoveComplete={jest.fn()} headingLevel="h2" pendingCount={null} paused={true} />);

      fireEvent.click(screen.getByLabelText(/^Retrigger now/));
      fireEvent.click(screen.getByText('Retrigger anyway'));

      await waitFor(() => {
        expect(globalThis.fetch).toHaveBeenCalledWith('/api/queue/' + items[0].uuid + '/retrigger-now?overridePause=true', {
          method: 'POST',
        });
      });
    });

    it('canceling the dialog does not call retriggerNow', () => {
      const items = [makeQueueItem()];
      render(<QueueOrder items={items} error={null} onMoveComplete={jest.fn()} headingLevel="h2" pendingCount={null} paused={true} />);

      fireEvent.click(screen.getByLabelText(/^Retrigger now/));
      fireEvent.click(screen.getByText('Cancel'));

      expect(screen.queryByText(/scheduler is currently paused. Retrigger anyway/)).not.toBeInTheDocument();
      expect(globalThis.fetch).not.toHaveBeenCalled();
    });
  });

  describe('move to top', () => {
    let item1: ReturnType<typeof makeQueueItem>;
    let item2: ReturnType<typeof makeQueueItem>;
    let onMoveComplete: jest.Mock;

    beforeEach(() => {
      item1 = makeQueueItem();
      item2 = makeQueueItem();
      onMoveComplete = jest.fn();
    });

    it('renders move-to-top button per row', () => {
      renderQueueOrder([item1, item2]);

      const buttons = screen.getAllByLabelText('Move to top');
      expect(buttons).toHaveLength(2);
    });

    it('calls moveToTop API on click', async () => {
      createMockFetch(204, undefined);
      renderQueueOrder([item1, item2], null, onMoveComplete);

      fireEvent.click(screen.getAllByLabelText('Move to top')[0]);

      await waitFor(() => {
        expect(globalThis.fetch).toHaveBeenCalledWith('/api/queue/order/move-to-top', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ queueItemUuid: item1.uuid }),
        });
      });
    });

    it('shows success toast on success', async () => {
      createMockFetch(204, undefined);
      renderQueueOrder([item1, item2], null, onMoveComplete);

      fireEvent.click(screen.getAllByLabelText('Move to top')[0]);

      await waitFor(() => {
        expect(screen.getByText('Moved to top')).toBeInTheDocument();
      });
    });

    it('calls onMoveComplete on success', async () => {
      createMockFetch(204, undefined);
      renderQueueOrder([item1, item2], null, onMoveComplete);

      fireEvent.click(screen.getAllByLabelText('Move to top')[0]);

      await waitFor(() => {
        expect(onMoveComplete).toHaveBeenCalled();
      });
    });

    const ERROR_MESSAGE_NOT_PENDING = 'Queue item is not pending';

    it('shows error toast on failure', async () => {
      createMockFetch(409, { error: ERROR_MESSAGE_NOT_PENDING });
      renderQueueOrder([item1, item2], null, onMoveComplete);

      fireEvent.click(screen.getAllByLabelText('Move to top')[0]);

      await waitFor(() => {
        expect(screen.getByText(ERROR_MESSAGE_NOT_PENDING)).toBeInTheDocument();
      });
    });

    it('button disabled while request in flight', async () => {
      let resolveMoveToTop!: (value: void | PromiseLike<void>) => void;
      const moveToTopPromise = new Promise<void>((resolve) => {
        resolveMoveToTop = resolve;
      });
      globalThis.fetch = jest.fn(() =>
        Promise.resolve({
          ok: true,
          status: 200,
          json: () => moveToTopPromise,
        } as Response),
      ) as unknown as typeof fetch;

      renderQueueOrder([item1, item2], null, onMoveComplete);
      fireEvent.click(screen.getAllByLabelText('Move to top')[0]);

      await waitFor(() => {
        expect(screen.getAllByLabelText('Move to top')[0]).toBeDisabled();
      });

      resolveMoveToTop();

      await waitFor(() => {
        expect(screen.getByText('Moved to top')).toBeInTheDocument();
      });
    });

    it('does not update state after unmount on success', async () => {
      let resolveMoveToTop!: (value: void | PromiseLike<void>) => void;
      const moveToTopPromise = new Promise<void>((resolve) => {
        resolveMoveToTop = resolve;
      });
      globalThis.fetch = jest.fn(() =>
        Promise.resolve({
          ok: true,
          status: 200,
          json: () => moveToTopPromise,
        } as Response),
      ) as unknown as typeof fetch;

      const { unmount } = renderQueueOrder([item1, item2], null, onMoveComplete);
      fireEvent.click(screen.getAllByLabelText('Move to top')[0]);
      unmount();

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      resolveMoveToTop();
      await new Promise((r) => setTimeout(r, 0));

      const stateUpdateWarnings = consoleErrorSpy.mock.calls.filter((call) => typeof call[0] === 'string' && (call[0] as string).includes('unmounted'));
      expect(stateUpdateWarnings).toHaveLength(0);
    });

    it('does not update state after unmount on error', async () => {
      let rejectMoveToTop!: (reason: Error) => void;
      const moveToTopFetchPromise = new Promise<Response>((_, reject) => {
        rejectMoveToTop = reject;
      });
      globalThis.fetch = jest.fn(() => moveToTopFetchPromise) as unknown as typeof fetch;

      const { unmount } = renderQueueOrder([item1, item2], null, onMoveComplete);
      fireEvent.click(screen.getAllByLabelText('Move to top')[0]);
      unmount();

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      rejectMoveToTop(new Error('Network error'));
      await new Promise((r) => setTimeout(r, 0));

      const stateUpdateWarnings = consoleErrorSpy.mock.calls.filter((call) => typeof call[0] === 'string' && (call[0] as string).includes('unmounted'));
      expect(stateUpdateWarnings).toHaveLength(0);
    });
  });
});
