import type { ExecutionContextAttribute } from './external-deps/couimet/execution-context/src/index.js';
// eslint-disable-next-line barrel-boundary/enforce-barrel-files -- the utils barrel reaches this file through domain.ts, so importing the barrel here closes a load cycle that throws
import { isNonBlankString } from './utils/isNonBlankString.js';

/**
 * The attributes this application puts in the execution context, each with the key it writes under and
 * the rule its value must meet.
 *
 * Writers and readers both go through this object, so no module can write `run_id` while another reads
 * `runId`, and a key that is not declared here is a compile error at the call site.
 */
export const EXECUTION_CONTEXT_ATTRIBUTES = {
  runId: { key: 'run_id', isValid: isNonBlankString },
  version: { key: 'version', isValid: isNonBlankString },
} as const satisfies Record<string, ExecutionContextAttribute<unknown>>;
