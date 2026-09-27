import { validateAttributes, withAttributes } from '../../../../src/external-deps/couimet/execution-context/src/index.js';

import { spyOnAttributeAdditions, withTestExecutionContext } from './index.js';

import { getUniqueString } from '@couimet/dynamic-testing';
import { ExecutionContext } from '@couimet/execution-context';
import { beforeEach, describe, expect, it } from '@jest/globals';

const ATTRIBUTES = {
  runId: { key: 'run_id' },
} as const;

describe('spyOnAttributeAdditions', () => {
  let addAttributes: ReturnType<typeof spyOnAttributeAdditions>;

  beforeEach(() => {
    addAttributes = spyOnAttributeAdditions();
  });

  it('records the attributes withAttributes layers over the context', () => {
    const attributeValue = getUniqueString();

    withTestExecutionContext(undefined, () => withAttributes(validateAttributes(ATTRIBUTES, { runId: attributeValue }), () => undefined));

    expect(addAttributes).toHaveBeenCalledWith({ run_id: attributeValue });
  });

  it('still adds the attributes to the active context', () => {
    const attributeValue = getUniqueString();

    const observed = withTestExecutionContext(undefined, () =>
      withAttributes(validateAttributes(ATTRIBUTES, { runId: attributeValue }), () => ExecutionContext.getAttributes()),
    );

    expect(observed).toStrictEqual({ run_id: attributeValue });
  });

  it('records nothing when the code under test adds no attribute', () => {
    withTestExecutionContext(undefined, () => undefined);

    expect(addAttributes).not.toHaveBeenCalled();
  });
});
