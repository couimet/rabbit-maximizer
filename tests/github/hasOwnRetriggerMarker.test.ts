import pkg from '../../package.json' with { type: 'json' };
import { hasOwnRetriggerMarker } from '../../src/github/index.js';

import { getUniqueString } from '@couimet/dynamic-testing';
import { beforeEach, describe, expect, it } from '@jest/globals';

const VERSION = pkg.version;

describe('hasOwnRetriggerMarker', () => {
  let runId: string;

  beforeEach(() => {
    runId = getUniqueString({ prefix: 'run-' });
  });

  it('returns true when the body contains the own marker prefix', () => {
    expect(hasOwnRetriggerMarker(`<!-- rabbit-maximizer v${VERSION} run=${runId}`)).toBe(true);
  });

  it('returns false when the body contains only the rate-limit marker', () => {
    expect(hasOwnRetriggerMarker('rate limited by coderabbit.ai')).toBe(false);
  });

  it('returns false for an empty string', () => {
    expect(hasOwnRetriggerMarker('')).toBe(false);
  });
});
