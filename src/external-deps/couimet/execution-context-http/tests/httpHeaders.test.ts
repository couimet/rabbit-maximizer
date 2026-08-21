import { HttpHeaders } from '../src/index.js';

import { describe, expect, it } from '@jest/globals';

describe('HttpHeaders', () => {
  it('has the correct values', () => {
    expect(HttpHeaders).toStrictEqual({
      CorrelationId: 'x-correlation-id',
      RequestId: 'x-request-id',
    });
  });
});
