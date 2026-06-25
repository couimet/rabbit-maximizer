import { jest } from '@jest/globals';

export const createMockFetch = (status: number, body: unknown): void => {
  globalThis.fetch = jest.fn(() =>
    Promise.resolve({
      ok: status >= 200 && status < 300,
      status,
      json: () => Promise.resolve(body),
    } as Response),
  ) as unknown as typeof fetch;
};
