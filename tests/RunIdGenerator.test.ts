import { RunIdGenerator } from '../src/services.js';

import { getUuid } from '@couimet/dynamic-testing';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

let pinnedRunId: string;

describe('RunIdGenerator', () => {
  beforeEach(() => {
    pinnedRunId = getUuid();
    jest.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue(pinnedRunId as ReturnType<typeof crypto.randomUUID>);
  });

  it('generates the id from the crypto global', () => {
    const generator = new RunIdGenerator();

    expect(generator.generate()).toBe(pinnedRunId);
    expect(globalThis.crypto.randomUUID).toHaveBeenCalledWith();
  });
});
