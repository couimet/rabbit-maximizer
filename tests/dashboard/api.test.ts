import { fetchSummary } from '../../dashboard/src/api.js';
import { afterEach, describe, expect, it, jest } from '@jest/globals';

describe('api', () => {
  afterEach(() => {
    (globalThis.fetch as jest.Mock).mockRestore?.();
  });

  describe('fetchSummary', () => {
    it('returns parsed JSON on success', async () => {
      const data = { queueCounts: { pending: 1, posted: 0, completed: 0, failed: 0 }, eventCounts24h: { detected: 1, enqueued: 0, posted: 0, rejected: 0, completed: 0, failed: 0 }, oldestPending: null };
      globalThis.fetch = jest.fn(() =>
        Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(data) } as Response),
      ) as jest.Mock;
      await expect(fetchSummary()).resolves.toStrictEqual(data);
    });

    it('throws with body error message on failure', async () => {
      globalThis.fetch = jest.fn(() =>
        Promise.resolve({ ok: false, status: 500, json: () => Promise.resolve({ error: 'Server error' }) } as Response),
      ) as jest.Mock;
      await expect(fetchSummary()).rejects.toThrow('Server error');
    });

    it('throws with HTTP status when body has no error field', async () => {
      globalThis.fetch = jest.fn(() =>
        Promise.resolve({ ok: false, status: 502, json: () => Promise.resolve({}) } as Response),
      ) as jest.Mock;
      await expect(fetchSummary()).rejects.toThrow('HTTP 502');
    });
  });
});
