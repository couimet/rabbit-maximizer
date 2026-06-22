import pkg from '../../package.json' with { type: 'json' };

import { getUniqueString } from '@couimet/dynamic-testing';
import { describe, expect, it, jest } from '@jest/globals';

const randomUUID = jest.fn();
jest.unstable_mockModule('node:crypto', () => ({ randomUUID }));

const { UuidObservationContextProvider } = await import('../../src/observability/observationContext.js');

describe('UuidObservationContextProvider', () => {
  const EXPECTED_UUID_CALLS = 2;

  it('returns uuid correlation and request ids plus the package version', () => {
    const correlationId = getUniqueString({ prefix: 'corr-' });
    const requestId = getUniqueString({ prefix: 'req-' });
    randomUUID.mockReturnValueOnce(correlationId).mockReturnValueOnce(requestId);

    const sut = new UuidObservationContextProvider();
    const result = sut.current();

    expect(result).toStrictEqual({
      correlationId,
      requestId,
      version: pkg.version,
    });
    expect(randomUUID).toHaveBeenCalledTimes(EXPECTED_UUID_CALLS);
  });
});
