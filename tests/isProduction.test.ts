import { isProduction } from '../src/domain.js';

import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';

describe('isProduction', () => {
  let prev: string | undefined;

  beforeEach(() => {
    prev = process.env.NODE_ENV;
  });

  afterEach(() => {
    process.env.NODE_ENV = prev;
  });

  it('returns true when NODE_ENV is "production"', () => {
    process.env.NODE_ENV = 'production';
    expect(isProduction()).toBe(true);
  });

  it('returns false when NODE_ENV is "development"', () => {
    process.env.NODE_ENV = 'development';
    expect(isProduction()).toBe(false);
  });

  it('returns false when NODE_ENV is undefined', () => {
    delete process.env.NODE_ENV;
    expect(isProduction()).toBe(false);
  });
});
