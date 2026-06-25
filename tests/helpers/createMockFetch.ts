import { jest } from '@jest/globals';

export const createMockFetch = (status: number, body: unknown): void => {
  globalThis.fetch = jest.fn(() =>
    Promise.resolve({
      ok: status < 400,
      status,
      json: () => Promise.resolve(body),
    } as Response),
  ) as unknown as typeof fetch;
};
