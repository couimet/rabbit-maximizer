import { DirectCheckCap } from '../src/services.js';

import { generateConfigData } from './helpers/index.js';

import { getRandomInt } from '@couimet/dynamic-testing';
import { describe, expect, it } from '@jest/globals';

describe('DirectCheckCap', () => {
  it('returns the configured cap', () => {
    const configuredCap = getRandomInt(1, 1000);

    const cap = new DirectCheckCap(generateConfigData({ MAX_DIRECT_CHECK_PRS: configuredCap }));

    expect(cap.max()).toBe(configuredCap);
  });

  it('returns 125 when the configuration omits the key', () => {
    const cap = new DirectCheckCap(generateConfigData());

    expect(cap.max()).toBe(125);
  });
});
