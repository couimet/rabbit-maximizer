import { fetchQueueOrder, fetchSummary, moveQueueItems } from '../../dashboard/src/api.js';

import { afterEach, describe, expect, it, jest } from '@jest/globals';

describe('api', () => {
  afterEach(() => {
    (globalThis.fetch as jest.Mock).mockRestore?.();
  });

  describe('fetchSummary', () => {
    it('returns parsed JSON on success', async () => {
      const data = {
        queueCounts: { pending: 1, posted: 0, completed: 0, failed: 0 },
        eventCounts24h: { detected: 1, enqueued: 0, posted: 0, bypassed: 0, completed: 0, failed: 0 },
        oldestPending: null,
      };
      globalThis.fetch = jest.fn(() => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(data) } as Response)) as unknown as typeof fetch;
      await expect(fetchSummary()).resolves.toStrictEqual(data);
    });

    it('throws with body error message on failure', async () => {
      globalThis.fetch = jest.fn(() =>
        Promise.resolve({ ok: false, status: 500, json: () => Promise.resolve({ error: 'Server error' }) } as Response),
      ) as unknown as typeof fetch;
      await expect(fetchSummary()).rejects.toThrow('Server error');
    });

    it('throws with HTTP status when body has no error field', async () => {
      globalThis.fetch = jest.fn(() => Promise.resolve({ ok: false, status: 502, json: () => Promise.resolve({}) } as Response)) as unknown as typeof fetch;
      await expect(fetchSummary()).rejects.toThrow('HTTP 502');
    });
  });

  describe('fetchQueueOrder', () => {
    it('returns parsed JSON on success', async () => {
      const data = { data: [{ id: 1, status: 'pending' }] };
      globalThis.fetch = jest.fn(() => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(data) } as Response)) as unknown as typeof fetch;
      await expect(fetchQueueOrder()).resolves.toStrictEqual(data);
    });

    it('throws with body error message on failure', async () => {
      globalThis.fetch = jest.fn(() =>
        Promise.resolve({ ok: false, status: 500, json: () => Promise.resolve({ error: 'Server error' }) } as Response),
      ) as unknown as typeof fetch;
      await expect(fetchQueueOrder()).rejects.toThrow('Server error');
    });

    it('throws with HTTP status when body has no error field', async () => {
      globalThis.fetch = jest.fn(() => Promise.resolve({ ok: false, status: 502, json: () => Promise.resolve({}) } as Response)) as unknown as typeof fetch;
      await expect(fetchQueueOrder()).rejects.toThrow('HTTP 502');
    });
  });

  describe('moveQueueItems', () => {
    it('sends POST with body and returns parsed JSON on success', async () => {
      const data = { data: [{ id: 1, status: 'pending' }] };
      globalThis.fetch = jest.fn(() => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(data) } as Response)) as unknown as typeof fetch;
      await expect(moveQueueItems([1, 2], 'up')).resolves.toStrictEqual(data);
      expect(globalThis.fetch).toHaveBeenCalledWith('/api/queue/order/move', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ queueItemIds: [1, 2], direction: 'up' }),
      });
    });

    it('throws with body error message on failure', async () => {
      globalThis.fetch = jest.fn(() =>
        Promise.resolve({ ok: false, status: 400, json: () => Promise.resolve({ error: 'Bad request' }) } as Response),
      ) as unknown as typeof fetch;
      await expect(moveQueueItems([1], 'down')).rejects.toThrow('Bad request');
    });

    it('throws with HTTP status when body has no error field', async () => {
      globalThis.fetch = jest.fn(() => Promise.resolve({ ok: false, status: 502, json: () => Promise.resolve({}) } as Response)) as unknown as typeof fetch;
      await expect(moveQueueItems([1], 'up')).rejects.toThrow('HTTP 502');
    });
  });
});
