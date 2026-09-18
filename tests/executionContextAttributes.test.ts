import { EXECUTION_CONTEXT_ATTRIBUTES } from '../src/executionContextAttributes.js';
import { isNonBlankString } from '../src/utils/index.js';

import { describe, expect, it } from '@jest/globals';

describe('EXECUTION_CONTEXT_ATTRIBUTES', () => {
  it('declares every attribute with its context key and its rule', () => {
    expect(EXECUTION_CONTEXT_ATTRIBUTES).toStrictEqual({
      runId: { key: 'run_id', isValid: isNonBlankString },
      version: { key: 'version', isValid: isNonBlankString },
    });
  });
});
