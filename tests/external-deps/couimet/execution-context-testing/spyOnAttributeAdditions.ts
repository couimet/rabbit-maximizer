import { ExecutionContext } from '@couimet/execution-context';
import { jest } from '@jest/globals';

/**
 * Replaces `ExecutionContext.addAttributes` with a spy that still calls through, so a
 * test asserts exactly which attributes the code under test added instead of reading
 * the merged result. `restoreMocks` removes the spy after each test (T005).
 */
export const spyOnAttributeAdditions = (): jest.SpiedFunction<typeof ExecutionContext.addAttributes> => jest.spyOn(ExecutionContext, 'addAttributes');
