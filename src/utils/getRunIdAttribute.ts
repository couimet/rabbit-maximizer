import { EXECUTION_CONTEXT_ATTRIBUTES } from '../domain.js';
import { getAttribute } from '../external-deps/couimet/execution-context/src/index.js';

/**
 * Reads the run id that scoped the current retrigger.
 *
 * Throws instead of returning undefined, so a caller that forgot to scope a run fails loud rather
 * than writing a row the dashboard cannot tie back to a retrigger. An inactive context and an absent
 * attribute are the same failure here, because `getAttribute` returns undefined for both.
 */
export const getRunIdAttribute = (): string => getAttribute(EXECUTION_CONTEXT_ATTRIBUTES.runId);
