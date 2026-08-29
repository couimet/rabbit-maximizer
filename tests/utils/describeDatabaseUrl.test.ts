import { describeDatabaseUrl } from '../../src/utils/index.js';

import { describe, expect, it } from '@jest/globals';

describe('describeDatabaseUrl', () => {
  it('returns protocol, host, and path — stripping query parameters', () => {
    expect(describeDatabaseUrl('file:./data/rabbit-maximizer.db?connection_limit=1')).toBe('file:///data/rabbit-maximizer.db');
  });

  it('returns protocol, host, and pathname for a file: URL', () => {
    expect(describeDatabaseUrl('file:./data/myapp.db')).toBe('file:///data/myapp.db');
  });

  it('strips credentials from a URL with user:password', () => {
    expect(describeDatabaseUrl('postgres://user:pass@localhost:5432/mydb')).toBe('postgres://localhost:5432/mydb');
  });

  it('returns only protocol, host, and path — no hash', () => {
    expect(describeDatabaseUrl('https://example.com/path#section')).toBe('https://example.com/path');
  });
});
