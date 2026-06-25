import { describeDatabaseUrl } from '../../src/utils/describeDatabaseUrl.js';

import { describe, expect, it } from '@jest/globals';

describe('describeDatabaseUrl', () => {
  it('returns protocol, host, and pathname from a full database URL', () => {
    const result = describeDatabaseUrl('postgresql://user:password@localhost:5432/mydb?schema=public');
    expect(result).toBe('postgresql://localhost:5432/mydb');
  });

  it('handles a minimal URL', () => {
    const result = describeDatabaseUrl('postgres://dbhost/dbname');
    expect(result).toBe('postgres://dbhost/dbname');
  });
});
