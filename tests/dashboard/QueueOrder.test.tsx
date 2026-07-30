/** @jest-environment jsdom */

import { QueueOrder } from '../../dashboard/src/index.js';
import { createMockFetch, generateQueueItemResponseData } from '../helpers/index.js';

import '@testing-library/jest-dom/jest-globals';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { StrictMode } from 'react';

const defaultOnMoveComplete = jest.fn();

/** @testFixture */
const renderQueueOrder = ({
  items,
  onMoveComplete,
  paused,
  schedulerStale,
  lastUpdatedAt,
  lastSchedulerTickAt,
}: {
  items: ReturnType<typeof makeQueueItem>[] | null;
  onMoveComplete: () => void;
  paused: boolean;
  schedulerStale: boolean;
  lastUpdatedAt: Date | null;
  lastSchedulerTickAt: string | null;
}) =>
  render(
    <QueueOrder
      items={items}
      schedulerStale={schedulerStale}
      lastUpdatedAt={lastUpdatedAt}
      lastSchedulerTickAt={lastSchedulerTickAt}
      onMoveComplete={onMoveComplete}
      headingLevel="h2"
      paused={paused}
    />,
  );

/** @testFixture */
const makeQueueItem = (over: Record<string, unknown> = {}) => generateQueueItemResponseData(over);

describe('QueueOrder', () => {
  afterEach(() => {
    localStorage.clear();
  });

  describe('loading', () => {
    it('shows loading text when items is null', () => {
      renderQueueOrder({
        items: null,
        onMoveComplete: defaultOnMoveComplete,
        paused: false,
        schedulerStale: false,
        lastUpdatedAt: null,
        lastSchedulerTickAt: null,
      });
      expect(screen.getByText('Loading queue order…')).toBeInTheDocument();
    });
  });

  describe('data', () => {
    let item1: ReturnType<typeof makeQueueItem>;
    let item2: ReturnType<typeof makeQueueItem>;

    beforeEach(() => {
      item1 = makeQueueItem({ status: 'pending' });
      item2 = makeQueueItem({ status: 'pending' });
    });

    it('renders queue order items with position numbers and details', () => {
      renderQueueOrder({
        items: [item1, item2],
        onMoveComplete: defaultOnMoveComplete,
        paused: false,
        schedulerStale: false,
        lastUpdatedAt: null,
        lastSchedulerTickAt: null,
      });

      expect(screen.getByText('1')).toBeInTheDocument();
      expect(screen.getByText('2')).toBeInTheDocument();
      expect(screen.getByText(`${item1.pr_title} (#${item1.pr_number})`)).toBeInTheDocument();
      expect(screen.getByText(`${item2.pr_title} (#${item2.pr_number})`)).toBeInTheDocument();
      expect(screen.getByText(`by ${item1.author_login}`)).toBeInTheDocument();
      expect(screen.getByText(`by ${item2.author_login}`)).toBeInTheDocument();
    });

    it('renders PR links opening in new tabs', () => {
      renderQueueOrder({
        items: [item1, item2],
        onMoveComplete: defaultOnMoveComplete,
        paused: false,
        schedulerStale: false,
        lastUpdatedAt: null,
        lastSchedulerTickAt: null,
      });
      const link = screen.getByText(`${item1.pr_title} (#${item1.pr_number})`).closest('a');
      expect(link).toHaveAttribute('href', `https://github.com/${item1.repo_full_name}/pull/${item1.pr_number}`);
      expect(link).toHaveAttribute('target', '_blank');
    });

    it('shows heading with counts derived from item statuses', () => {
      const pendingItem1 = makeQueueItem({ status: 'pending' });
      const pendingItem2 = makeQueueItem({ status: 'pending' });
      const retriggeredItem = makeQueueItem({ status: 'retriggered' });
      render(
        <QueueOrder
          items={[pendingItem1, pendingItem2, retriggeredItem]}
          schedulerStale={false}
          lastUpdatedAt={null}
          lastSchedulerTickAt={null}
          onMoveComplete={jest.fn()}
          headingLevel="h2"
          paused={false}
        />,
      );
      expect(screen.getByRole('heading', { name: 'Queue Order — 2 pending, 1 retriggered' })).toBeInTheDocument();
    });

    it('renders up and down arrow buttons per row', () => {
      renderQueueOrder({
        items: [item1, item2],
        onMoveComplete: defaultOnMoveComplete,
        paused: false,
        schedulerStale: false,
        lastUpdatedAt: null,
        lastSchedulerTickAt: null,
      });
      const upButtons = screen.getAllByLabelText('Move up');
      const downButtons = screen.getAllByLabelText('Move down');
      expect(upButtons).toHaveLength(2);
      expect(downButtons).toHaveLength(2);
    });
  });

  describe('empty', () => {
    it('shows empty message when items is empty', () => {
      renderQueueOrder({
        items: [],
        onMoveComplete: defaultOnMoveComplete,
        paused: false,
        schedulerStale: false,
        lastUpdatedAt: null,
        lastSchedulerTickAt: null,
      });
      expect(screen.getByText('No items in queue.')).toBeInTheDocument();
    });
  });

  describe('cleanup', () => {
    it('does not update state after unmount when move request resolves', async () => {
      const items = [makeQueueItem({ status: 'pending' }), makeQueueItem({ status: 'pending' })];

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

      const { unmount } = renderQueueOrder({
        items,
        onMoveComplete: defaultOnMoveComplete,
        paused: false,
        schedulerStale: false,
        lastUpdatedAt: null,
        lastSchedulerTickAt: null,
      });
      fireEvent.click(screen.getAllByLabelText('Move up')[0]);
      unmount();

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      resolveMove({ data: [makeQueueItem({ status: 'pending' }), makeQueueItem({ status: 'pending' })] });
      await new Promise((r) => setTimeout(r, 0));

      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    it('allows move after StrictMode double-invoke', async () => {
      const items = [makeQueueItem({ status: 'pending' }), makeQueueItem({ status: 'pending' })];
      const onMoveComplete = jest.fn();

      globalThis.fetch = jest.fn(() =>
        Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ data: [makeQueueItem({ status: 'pending' }), makeQueueItem({ status: 'pending' })] }),
        } as Response),
      ) as unknown as typeof fetch;

      render(
        <StrictMode>
          <QueueOrder
            items={items}
            schedulerStale={false}
            lastUpdatedAt={null}
            lastSchedulerTickAt={null}
            onMoveComplete={onMoveComplete}
            headingLevel="h2"
            paused={false}
          />
        </StrictMode>,
      );

      fireEvent.click(screen.getAllByLabelText('Move up')[0]);

      await waitFor(() => {
        expect(onMoveComplete).toHaveBeenCalled();
      });
    });

    it('does not update state after unmount when move request fails', async () => {
      const items = [makeQueueItem({ status: 'pending' }), makeQueueItem({ status: 'pending' })];

      let rejectMove!: (reason: Error) => void;
      const moveFetchPromise = new Promise<Response>((_, reject) => {
        rejectMove = reject;
      });
      globalThis.fetch = jest.fn(() => moveFetchPromise) as unknown as typeof fetch;

      const { unmount } = renderQueueOrder({
        items,
        onMoveComplete: defaultOnMoveComplete,
        paused: false,
        schedulerStale: false,
        lastUpdatedAt: null,
        lastSchedulerTickAt: null,
      });
      fireEvent.click(screen.getAllByLabelText('Move up')[0]);
      unmount();

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      rejectMove(new Error('Network error'));
      await new Promise((r) => setTimeout(r, 0));

      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });
  });

  describe('select all', () => {
    const items = [makeQueueItem({ status: 'pending' }), makeQueueItem({ status: 'pending' })];

    it('selects all items when header checkbox is clicked', () => {
      renderQueueOrder({
        items: [...items],
        onMoveComplete: defaultOnMoveComplete,
        paused: false,
        schedulerStale: false,
        lastUpdatedAt: null,
        lastSchedulerTickAt: null,
      });
      const checkboxes = screen.getAllByRole('checkbox');
      fireEvent.click(checkboxes[0]);

      expect(checkboxes[0]).toBeChecked();
      expect(checkboxes[1]).toBeChecked();
      expect(checkboxes[2]).toBeChecked();
    });

    it('deselects all when header checkbox is clicked twice', () => {
      renderQueueOrder({
        items: [...items],
        onMoveComplete: defaultOnMoveComplete,
        paused: false,
        schedulerStale: false,
        lastUpdatedAt: null,
        lastSchedulerTickAt: null,
      });
      const checkboxes = screen.getAllByRole('checkbox');
      fireEvent.click(checkboxes[0]);
      fireEvent.click(checkboxes[0]);

      expect(checkboxes[0]).not.toBeChecked();
      expect(checkboxes[1]).not.toBeChecked();
      expect(checkboxes[2]).not.toBeChecked();
    });

    it('toggles individual item selection on checkbox click', () => {
      renderQueueOrder({
        items: [...items],
        onMoveComplete: defaultOnMoveComplete,
        paused: false,
        schedulerStale: false,
        lastUpdatedAt: null,
        lastSchedulerTickAt: null,
      });
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
      item1 = makeQueueItem({ status: 'pending' });
      item2 = makeQueueItem({ status: 'pending' });
      onMoveComplete = jest.fn();
    });

    const moveResponse = () => ({ data: [makeQueueItem({ status: 'pending' }), makeQueueItem({ status: 'pending' })] });

    it('calls moveQueueItems with correct args on single up click', async () => {
      createMockFetch(200, moveResponse());
      renderQueueOrder({ items: [item1, item2], onMoveComplete, paused: false, schedulerStale: false, lastUpdatedAt: null, lastSchedulerTickAt: null });

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
      renderQueueOrder({ items: [item1, item2], onMoveComplete, paused: false, schedulerStale: false, lastUpdatedAt: null, lastSchedulerTickAt: null });

      fireEvent.click(screen.getAllByLabelText('Move up')[0]);

      await waitFor(() => {
        expect(onMoveComplete).toHaveBeenCalled();
      });
    });

    it('calls moveQueueItems with correct args on single down click', async () => {
      createMockFetch(200, moveResponse());
      renderQueueOrder({ items: [item1, item2], onMoveComplete, paused: false, schedulerStale: false, lastUpdatedAt: null, lastSchedulerTickAt: null });

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
      renderQueueOrder({ items: [item1, item2], onMoveComplete, paused: false, schedulerStale: false, lastUpdatedAt: null, lastSchedulerTickAt: null });

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
      renderQueueOrder({ items: [item1, item2], onMoveComplete, paused: false, schedulerStale: false, lastUpdatedAt: null, lastSchedulerTickAt: null });

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
      renderQueueOrder({ items: [item1, item2], onMoveComplete, paused: false, schedulerStale: false, lastUpdatedAt: null, lastSchedulerTickAt: null });

      createMockFetch(500, { error: 'Server error' });
      fireEvent.click(screen.getAllByLabelText('Move up')[0]);

      await waitFor(() => expect(screen.getByText('Move failed: Server error')).toBeInTheDocument());
    });

    it('shows error message when response data is not an array', async () => {
      renderQueueOrder({ items: [item1, item2], onMoveComplete, paused: false, schedulerStale: false, lastUpdatedAt: null, lastSchedulerTickAt: null });

      createMockFetch(200, { data: null });
      fireEvent.click(screen.getAllByLabelText('Move up')[0]);

      await waitFor(() => expect(screen.getByText('Move failed: Unexpected response from server')).toBeInTheDocument());
    });
  });

  describe('Status column', () => {
    it('renders Status column header', () => {
      renderQueueOrder({
        items: [makeQueueItem({ status: 'pending' })],
        onMoveComplete: defaultOnMoveComplete,
        paused: false,
        schedulerStale: false,
        lastUpdatedAt: null,
        lastSchedulerTickAt: null,
      });
      expect(screen.getByText('Status')).toBeInTheDocument();
    });

    it('applies row-waiting class to positions greater than 1', () => {
      renderQueueOrder({
        items: [makeQueueItem({ status: 'pending' }), makeQueueItem({ status: 'pending' })],
        onMoveComplete: defaultOnMoveComplete,
        paused: false,
        schedulerStale: false,
        lastUpdatedAt: null,
        lastSchedulerTickAt: null,
      });
      const rows = screen.getAllByRole('row');
      expect(rows[2].classList.contains('row-waiting')).toBe(true);
    });

    it('does not apply row-waiting class to position 1', () => {
      renderQueueOrder({
        items: [makeQueueItem({ status: 'pending' }), makeQueueItem({ status: 'pending' })],
        onMoveComplete: defaultOnMoveComplete,
        paused: false,
        schedulerStale: false,
        lastUpdatedAt: null,
        lastSchedulerTickAt: null,
      });
      const rows = screen.getAllByRole('row');
      expect(rows[1].classList.contains('row-waiting')).toBe(false);
    });
  });

  describe('retrigger now', () => {
    let item1: ReturnType<typeof makeQueueItem>;
    let item2: ReturnType<typeof makeQueueItem>;
    let onMoveComplete: jest.Mock;

    beforeEach(() => {
      item1 = makeQueueItem({ status: 'pending' });
      item2 = makeQueueItem({ status: 'pending' });
      onMoveComplete = jest.fn();
    });

    it('renders lightning-bolt button per row', () => {
      renderQueueOrder({
        items: [item1, item2],
        onMoveComplete: defaultOnMoveComplete,
        paused: false,
        schedulerStale: false,
        lastUpdatedAt: null,
        lastSchedulerTickAt: null,
      });

      const buttons = screen.getAllByLabelText(/^Retrigger now/);
      expect(buttons).toHaveLength(2);
    });

    it('calls retriggerNow API on click', async () => {
      createMockFetch(204, undefined);
      renderQueueOrder({ items: [item1, item2], onMoveComplete, paused: false, schedulerStale: false, lastUpdatedAt: null, lastSchedulerTickAt: null });

      fireEvent.click(screen.getAllByLabelText(/^Retrigger now/)[0]);

      await waitFor(() => {
        expect(globalThis.fetch).toHaveBeenCalledWith('/api/queue/' + item1.uuid + '/retrigger-now', {
          method: 'POST',
        });
      });
    });

    it('shows success toast with interval on success', async () => {
      createMockFetch(204, undefined);
      renderQueueOrder({ items: [item1, item2], onMoveComplete, paused: false, schedulerStale: false, lastUpdatedAt: null, lastSchedulerTickAt: null });

      fireEvent.click(screen.getAllByLabelText(/^Retrigger now/)[0]);

      await waitFor(() => {
        expect(screen.getByText('Retrigger requested')).toBeInTheDocument();
      });
    });

    it('shows error toast on failure', async () => {
      createMockFetch(500, { error: 'Rate limited' });
      renderQueueOrder({ items: [item1, item2], onMoveComplete, paused: false, schedulerStale: false, lastUpdatedAt: null, lastSchedulerTickAt: null });

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

      renderQueueOrder({ items: [item1, item2], onMoveComplete, paused: false, schedulerStale: false, lastUpdatedAt: null, lastSchedulerTickAt: null });
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
      renderQueueOrder({ items: [item1, item2], onMoveComplete, paused: false, schedulerStale: false, lastUpdatedAt: null, lastSchedulerTickAt: null });

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

      const { unmount } = renderQueueOrder({
        items: [item1, item2],
        onMoveComplete,
        paused: false,
        schedulerStale: false,
        lastUpdatedAt: null,
        lastSchedulerTickAt: null,
      });
      fireEvent.click(screen.getAllByLabelText(/^Retrigger now/)[0]);
      unmount();

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      resolveRetrigger();
      await new Promise((r) => setTimeout(r, 0));

      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    it('does not update state after unmount on error', async () => {
      let rejectRetrigger!: (reason: Error) => void;
      const retriggerFetchPromise = new Promise<Response>((_, reject) => {
        rejectRetrigger = reject;
      });
      globalThis.fetch = jest.fn(() => retriggerFetchPromise) as unknown as typeof fetch;

      const { unmount } = renderQueueOrder({
        items: [item1, item2],
        onMoveComplete,
        paused: false,
        schedulerStale: false,
        lastUpdatedAt: null,
        lastSchedulerTickAt: null,
      });
      fireEvent.click(screen.getAllByLabelText(/^Retrigger now/)[0]);
      unmount();

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      rejectRetrigger(new Error('Network error'));
      await new Promise((r) => setTimeout(r, 0));

      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    it('retrigger buttons are enabled when paused is false', () => {
      const items = [makeQueueItem({ status: 'pending' })];
      render(
        <QueueOrder
          items={items}
          schedulerStale={false}
          lastUpdatedAt={null}
          lastSchedulerTickAt={null}
          onMoveComplete={jest.fn()}
          headingLevel="h2"
          paused={false}
        />,
      );

      expect(screen.getByLabelText(/^Retrigger now/)).not.toBeDisabled();
    });

    it('retrigger buttons are enabled when paused is true', () => {
      const items = [makeQueueItem({ status: 'pending' })];
      render(
        <QueueOrder
          items={items}
          schedulerStale={false}
          lastUpdatedAt={null}
          lastSchedulerTickAt={null}
          onMoveComplete={jest.fn()}
          headingLevel="h2"
          paused={true}
        />,
      );

      expect(screen.getByLabelText(/^Retrigger now/)).not.toBeDisabled();
    });

    it('shows confirmation dialog when retrigger is clicked while paused', () => {
      const items = [makeQueueItem({ status: 'pending' })];
      render(
        <QueueOrder
          items={items}
          schedulerStale={false}
          lastUpdatedAt={null}
          lastSchedulerTickAt={null}
          onMoveComplete={jest.fn()}
          headingLevel="h2"
          paused={true}
        />,
      );

      fireEvent.click(screen.getByLabelText(/^Retrigger now/));

      expect(screen.getByText(/scheduler is currently paused. Retrigger anyway/)).toBeInTheDocument();
      expect(screen.getByText('Retrigger anyway')).toBeInTheDocument();
    });

    it('confirming the dialog calls retriggerNow with overridePause=true', async () => {
      createMockFetch(204, undefined);
      const items = [makeQueueItem({ status: 'pending' })];
      render(
        <QueueOrder
          items={items}
          schedulerStale={false}
          lastUpdatedAt={null}
          lastSchedulerTickAt={null}
          onMoveComplete={jest.fn()}
          headingLevel="h2"
          paused={true}
        />,
      );

      fireEvent.click(screen.getByLabelText(/^Retrigger now/));
      fireEvent.click(screen.getByText('Retrigger anyway'));

      await waitFor(() => {
        expect(globalThis.fetch).toHaveBeenCalledWith('/api/queue/' + items[0].uuid + '/retrigger-now?overridePause=true', {
          method: 'POST',
        });
      });
    });

    it('canceling the dialog does not call retriggerNow', () => {
      const items = [makeQueueItem({ status: 'pending' })];
      render(
        <QueueOrder
          items={items}
          schedulerStale={false}
          lastUpdatedAt={null}
          lastSchedulerTickAt={null}
          onMoveComplete={jest.fn()}
          headingLevel="h2"
          paused={true}
        />,
      );

      fireEvent.click(screen.getByLabelText(/^Retrigger now/));
      fireEvent.click(screen.getByText('Cancel'));

      expect(screen.queryByText(/scheduler is currently paused. Retrigger anyway/)).not.toBeInTheDocument();
      expect(globalThis.fetch).not.toHaveBeenCalled();
    });

    it('does not call retriggerNow when confirming after scheduler became stale', () => {
      globalThis.fetch = jest.fn(() =>
        Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(undefined) } as Response),
      ) as unknown as typeof fetch;
      const items = [makeQueueItem({ status: 'pending' })];

      const { rerender } = render(
        <QueueOrder
          items={items}
          schedulerStale={false}
          lastUpdatedAt={null}
          lastSchedulerTickAt={null}
          onMoveComplete={jest.fn()}
          headingLevel="h2"
          paused={true}
        />,
      );

      fireEvent.click(screen.getByLabelText(/^Retrigger now/));
      expect(screen.getByText('Retrigger anyway')).toBeInTheDocument();

      rerender(
        <QueueOrder
          items={items}
          schedulerStale={true}
          lastUpdatedAt={null}
          lastSchedulerTickAt={null}
          onMoveComplete={jest.fn()}
          headingLevel="h2"
          paused={true}
        />,
      );

      fireEvent.click(screen.getByText('Retrigger anyway'));

      expect(globalThis.fetch).not.toHaveBeenCalled();
    });
  });

  describe('move to top', () => {
    let item1: ReturnType<typeof makeQueueItem>;
    let item2: ReturnType<typeof makeQueueItem>;
    let onMoveComplete: jest.Mock;

    beforeEach(() => {
      item1 = makeQueueItem({ status: 'pending' });
      item2 = makeQueueItem({ status: 'pending' });
      onMoveComplete = jest.fn();
    });

    it('renders move-to-top button per row', () => {
      renderQueueOrder({
        items: [item1, item2],
        onMoveComplete: defaultOnMoveComplete,
        paused: false,
        schedulerStale: false,
        lastUpdatedAt: null,
        lastSchedulerTickAt: null,
      });

      const buttons = screen.getAllByLabelText('Move to top');
      expect(buttons).toHaveLength(2);
    });

    it('calls moveToTop API on click', async () => {
      createMockFetch(204, undefined);
      renderQueueOrder({ items: [item1, item2], onMoveComplete, paused: false, schedulerStale: false, lastUpdatedAt: null, lastSchedulerTickAt: null });

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
      renderQueueOrder({ items: [item1, item2], onMoveComplete, paused: false, schedulerStale: false, lastUpdatedAt: null, lastSchedulerTickAt: null });

      fireEvent.click(screen.getAllByLabelText('Move to top')[0]);

      await waitFor(() => {
        expect(screen.getByText('Moved to top')).toBeInTheDocument();
      });
    });

    it('calls onMoveComplete on success', async () => {
      createMockFetch(204, undefined);
      renderQueueOrder({ items: [item1, item2], onMoveComplete, paused: false, schedulerStale: false, lastUpdatedAt: null, lastSchedulerTickAt: null });

      fireEvent.click(screen.getAllByLabelText('Move to top')[0]);

      await waitFor(() => {
        expect(onMoveComplete).toHaveBeenCalled();
      });
    });

    const ERROR_MESSAGE_NOT_PENDING = 'Queue item is already resolved';

    it('shows error toast on failure', async () => {
      createMockFetch(409, { error: ERROR_MESSAGE_NOT_PENDING });
      renderQueueOrder({ items: [item1, item2], onMoveComplete, paused: false, schedulerStale: false, lastUpdatedAt: null, lastSchedulerTickAt: null });

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

      renderQueueOrder({ items: [item1, item2], onMoveComplete, paused: false, schedulerStale: false, lastUpdatedAt: null, lastSchedulerTickAt: null });
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

      const { unmount } = renderQueueOrder({
        items: [item1, item2],
        onMoveComplete,
        paused: false,
        schedulerStale: false,
        lastUpdatedAt: null,
        lastSchedulerTickAt: null,
      });
      fireEvent.click(screen.getAllByLabelText('Move to top')[0]);
      unmount();

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      resolveMoveToTop();
      await new Promise((r) => setTimeout(r, 0));

      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    it('does not update state after unmount on error', async () => {
      let rejectMoveToTop!: (reason: Error) => void;
      const moveToTopFetchPromise = new Promise<Response>((_, reject) => {
        rejectMoveToTop = reject;
      });
      globalThis.fetch = jest.fn(() => moveToTopFetchPromise) as unknown as typeof fetch;

      const { unmount } = renderQueueOrder({
        items: [item1, item2],
        onMoveComplete,
        paused: false,
        schedulerStale: false,
        lastUpdatedAt: null,
        lastSchedulerTickAt: null,
      });
      fireEvent.click(screen.getAllByLabelText('Move to top')[0]);
      unmount();

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      rejectMoveToTop(new Error('Network error'));
      await new Promise((r) => setTimeout(r, 0));

      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });
  });

  describe('stale', () => {
    it('renders stale banner with heartbeat info when schedulerStale is true', () => {
      const items = [makeQueueItem({ status: 'pending' })];
      renderQueueOrder({
        items,
        onMoveComplete: jest.fn(),
        paused: false,
        schedulerStale: true,
        lastUpdatedAt: new Date(),
        lastSchedulerTickAt: '2026-07-28T10:00:00Z',
      });

      expect(screen.getByText(/Scheduler may be down — no heartbeat for/)).toBeInTheDocument();
      expect(screen.getByText(/Data refreshed/)).toBeInTheDocument();
    });

    it('shows "unknown" fallback when lastSchedulerTickAt is null', () => {
      const items = [makeQueueItem({ status: 'pending' })];
      renderQueueOrder({ items, onMoveComplete: jest.fn(), paused: false, schedulerStale: true, lastUpdatedAt: null, lastSchedulerTickAt: null });

      expect(screen.getByText('Scheduler may be down — no heartbeat for unknown')).toBeInTheDocument();
    });

    it('does not show "Data refreshed" line when lastUpdatedAt is null', () => {
      const items = [makeQueueItem({ status: 'pending' })];
      renderQueueOrder({
        items,
        onMoveComplete: jest.fn(),
        paused: false,
        schedulerStale: true,
        lastUpdatedAt: null,
        lastSchedulerTickAt: '2026-07-28T10:00:00Z',
      });

      expect(screen.getByText(/Scheduler may be down — no heartbeat for/)).toBeInTheDocument();
      expect(screen.queryByText(/Data refreshed/)).not.toBeInTheDocument();
    });

    it('shows stale banner when items is empty', () => {
      renderQueueOrder({
        items: [],
        onMoveComplete: jest.fn(),
        paused: false,
        schedulerStale: true,
        lastUpdatedAt: new Date(),
        lastSchedulerTickAt: '2026-07-28T10:00:00Z',
      });

      expect(screen.getByText(/Scheduler may be down/)).toBeInTheDocument();
      expect(screen.getByText('No items in queue.')).toBeInTheDocument();
    });

    it('shows stale banner when items is null (loading)', () => {
      renderQueueOrder({
        items: null,
        onMoveComplete: jest.fn(),
        paused: false,
        schedulerStale: true,
        lastUpdatedAt: new Date(),
        lastSchedulerTickAt: '2026-07-28T10:00:00Z',
      });

      expect(screen.getByText(/Scheduler may be down/)).toBeInTheDocument();
      expect(screen.getByText('Loading queue order…')).toBeInTheDocument();
    });

    it('disables all action buttons when schedulerStale is true', () => {
      const items = [makeQueueItem({ status: 'pending' })];
      renderQueueOrder({
        items,
        onMoveComplete: jest.fn(),
        paused: false,
        schedulerStale: true,
        lastUpdatedAt: new Date(),
        lastSchedulerTickAt: '2026-07-28T10:00:00Z',
      });

      const upButtons = screen.getAllByLabelText('Move up');
      const downButtons = screen.getAllByLabelText('Move down');
      const retriggerButtons = screen.getAllByLabelText(/^Retrigger now/);
      const moveToTopButtons = screen.getAllByLabelText('Move to top');

      for (const btn of [...upButtons, ...downButtons, ...retriggerButtons, ...moveToTopButtons, screen.getByText('Move Up'), screen.getByText('Move Down')]) {
        expect(btn).toBeDisabled();
      }
    });

    it('disables checkboxes when schedulerStale is true', () => {
      const items = [makeQueueItem({ status: 'pending' })];
      renderQueueOrder({
        items,
        onMoveComplete: jest.fn(),
        paused: false,
        schedulerStale: true,
        lastUpdatedAt: new Date(),
        lastSchedulerTickAt: '2026-07-28T10:00:00Z',
      });

      const checkboxes = screen.getAllByRole('checkbox');
      for (const cb of checkboxes) {
        expect(cb).toBeDisabled();
      }
    });

    it('toolbar buttons have title when schedulerStale is true', () => {
      const items = [makeQueueItem({ status: 'pending' })];
      renderQueueOrder({
        items,
        onMoveComplete: jest.fn(),
        paused: false,
        schedulerStale: true,
        lastUpdatedAt: new Date(),
        lastSchedulerTickAt: '2026-07-28T10:00:00Z',
      });

      expect(screen.getByText('Move Up')).toHaveAttribute('title', 'Unavailable while scheduler is down');
      expect(screen.getByText('Move Down')).toHaveAttribute('title', 'Unavailable while scheduler is down');
    });

    it('checkboxes have title when schedulerStale is true', () => {
      const items = [makeQueueItem({ status: 'pending' })];
      renderQueueOrder({
        items,
        onMoveComplete: jest.fn(),
        paused: false,
        schedulerStale: true,
        lastUpdatedAt: new Date(),
        lastSchedulerTickAt: '2026-07-28T10:00:00Z',
      });

      const checkboxes = screen.getAllByRole('checkbox');
      for (const cb of checkboxes) {
        expect(cb).toHaveAttribute('title', 'Unavailable while scheduler is down');
      }
    });

    it('per-row buttons have title when schedulerStale is true', () => {
      const items = [makeQueueItem({ status: 'pending' })];
      renderQueueOrder({
        items,
        onMoveComplete: jest.fn(),
        paused: false,
        schedulerStale: true,
        lastUpdatedAt: new Date(),
        lastSchedulerTickAt: '2026-07-28T10:00:00Z',
      });

      expect(screen.getByLabelText(/^Retrigger now/)).toHaveAttribute('title', 'Unavailable while scheduler is down');
      expect(screen.getByLabelText('Move to top')).toHaveAttribute('title', 'Unavailable while scheduler is down');
      expect(screen.getAllByLabelText('Move up')[0]).toHaveAttribute('title', 'Unavailable while scheduler is down');
      expect(screen.getAllByLabelText('Move down')[0]).toHaveAttribute('title', 'Unavailable while scheduler is down');
    });
  });
});
