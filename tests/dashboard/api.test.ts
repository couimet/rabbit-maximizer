import {
  fetchDashboardState,
  fetchEvents,
  fetchQueue,
  fetchQueueOrder,
  fetchSummary,
  markReviewed,
  moveQueueItems,
  moveToTop,
} from '../../dashboard/src/api.js';

import { describe, expect, it, jest } from '@jest/globals';

describe('api', () => {
  describe('fetchSummary', () => {
    it('returns parsed JSON on success', async () => {
      const data = {
        queueCounts: { pending: 1, retriggered: 0, reviewed: 0, failed: 0 },
        eventCounts: { detected: 1, enqueued: 0, retriggered: 0, failed: 0 },
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

    it('appends duration query param when provided', async () => {
      const data = {
        queueCounts: { pending: 0, retriggered: 0, failed: 0 },
        eventCounts: { detected: 0, enqueued: 0, retriggered: 0, failed: 0 },
        oldestPending: null,
      };
      globalThis.fetch = jest.fn(() => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(data) } as Response)) as unknown as typeof fetch;
      await fetchSummary('2d');
      expect(globalThis.fetch).toHaveBeenCalledWith('/api/summary?duration=2d', undefined);
    });
  });

  describe('fetchQueue', () => {
    it('returns parsed JSON on success', async () => {
      const data = { data: [], total: 0, page: 1, pageSize: 20 };
      globalThis.fetch = jest.fn(() => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(data) } as Response)) as unknown as typeof fetch;
      await expect(fetchQueue(1, 20)).resolves.toStrictEqual(data);
      expect(globalThis.fetch).toHaveBeenCalledWith('/api/queue?page=1&pageSize=20', undefined);
    });
  });

  describe('fetchEvents', () => {
    it('returns parsed JSON on success', async () => {
      const data = { data: [], total: 0, page: 1, pageSize: 50 };
      globalThis.fetch = jest.fn(() => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(data) } as Response)) as unknown as typeof fetch;
      await expect(fetchEvents(1, 50)).resolves.toStrictEqual(data);
      expect(globalThis.fetch).toHaveBeenCalledWith('/api/events?page=1&pageSize=50', undefined);
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

  describe('fetchDashboardState', () => {
    it('returns parsed JSON on success', async () => {
      const data = {
        nextReviewAvailableAt: null,
        pendingItems: [],
        eventCounts: { detected: 0, enqueued: 0, retriggered: 0, failed: 0 },
      };
      globalThis.fetch = jest.fn(() => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(data) } as Response)) as unknown as typeof fetch;
      await expect(fetchDashboardState()).resolves.toStrictEqual(data);
    });

    it('throws with body error message on failure', async () => {
      globalThis.fetch = jest.fn(() =>
        Promise.resolve({ ok: false, status: 500, json: () => Promise.resolve({ error: 'Server error' }) } as Response),
      ) as unknown as typeof fetch;
      await expect(fetchDashboardState()).rejects.toThrow('Server error');
    });

    it('throws with HTTP status when body has no error field', async () => {
      globalThis.fetch = jest.fn(() => Promise.resolve({ ok: false, status: 502, json: () => Promise.resolve({}) } as Response)) as unknown as typeof fetch;
      await expect(fetchDashboardState()).rejects.toThrow('HTTP 502');
    });

    it('appends duration query param when provided', async () => {
      const data = {
        nextReviewAvailableAt: null,
        pendingItems: [],
        eventCounts: { detected: 0, enqueued: 0, retriggered: 0, failed: 0 },
      };
      globalThis.fetch = jest.fn(() => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(data) } as Response)) as unknown as typeof fetch;
      await fetchDashboardState('2d');
      expect(globalThis.fetch).toHaveBeenCalledWith('/api/dashboard-state?duration=2d', undefined);
    });
  });

  describe('moveQueueItems', () => {
    it('sends POST with body and returns parsed JSON on success', async () => {
      const data = { data: [{ id: 1, status: 'pending' }] };
      globalThis.fetch = jest.fn(() => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(data) } as Response)) as unknown as typeof fetch;
      await expect(moveQueueItems(['uuid-1', 'uuid-2'], 'up')).resolves.toStrictEqual(data);
      expect(globalThis.fetch).toHaveBeenCalledWith('/api/queue/order/move', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ queueItemUuids: ['uuid-1', 'uuid-2'], direction: 'up' }),
      });
    });

    it('throws with body error message on failure', async () => {
      globalThis.fetch = jest.fn(() =>
        Promise.resolve({ ok: false, status: 400, json: () => Promise.resolve({ error: 'Bad request' }) } as Response),
      ) as unknown as typeof fetch;
      await expect(moveQueueItems(['uuid-1'], 'down')).rejects.toThrow('Bad request');
    });

    it('throws with HTTP status when body has no error field', async () => {
      globalThis.fetch = jest.fn(() => Promise.resolve({ ok: false, status: 502, json: () => Promise.resolve({}) } as Response)) as unknown as typeof fetch;
      await expect(moveQueueItems(['uuid-1'], 'up')).rejects.toThrow('HTTP 502');
    });
  });

  describe('moveToTop', () => {
    const UUID = '11111111-1111-1111-1111-111111111111';

    it('sends POST with body and resolves on 204', async () => {
      globalThis.fetch = jest.fn(() => Promise.resolve({ ok: true, status: 204 } as Response)) as unknown as typeof fetch;
      await expect(moveToTop(UUID)).resolves.toBeUndefined();
      expect(globalThis.fetch).toHaveBeenCalledWith('/api/queue/order/move-to-top', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ queueItemUuid: UUID }),
      });
    });

    it('throws with body error message on failure', async () => {
      globalThis.fetch = jest.fn(() =>
        Promise.resolve({ ok: false, status: 409, json: () => Promise.resolve({ error: 'Queue item is not pending' }) } as Response),
      ) as unknown as typeof fetch;
      await expect(moveToTop(UUID)).rejects.toThrow('Queue item is not pending');
    });

    it('throws with HTTP status when body has no error field', async () => {
      globalThis.fetch = jest.fn(() => Promise.resolve({ ok: false, status: 502, json: () => Promise.resolve({}) } as Response)) as unknown as typeof fetch;
      await expect(moveToTop(UUID)).rejects.toThrow('HTTP 502');
    });
  });

  describe('markReviewed', () => {
    const UUID = '11111111-1111-1111-1111-111111111111';

    it('returns parsed JSON on success', async () => {
      globalThis.fetch = jest.fn(() =>
        Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ ok: true }) } as Response),
      ) as unknown as typeof fetch;
      await expect(markReviewed(UUID)).resolves.toStrictEqual({ ok: true });
    });

    it('throws with body error message on failure', async () => {
      globalThis.fetch = jest.fn(() =>
        Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve({ error: 'Not found' }) } as Response),
      ) as unknown as typeof fetch;
      await expect(markReviewed(UUID)).rejects.toThrow('Not found');
    });
  });
});
