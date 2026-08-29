import type { PRState } from '../types/index.js';

const PR_STATE_CLOSED = 'closed';

const isPRClosed = (prState: PRState): boolean => prState.state === PR_STATE_CLOSED;
export const isPRMerged = (prState: PRState): boolean => isPRClosed(prState) && !!prState.merged_at;
export const isPRClosedWithoutMerge = (prState: PRState): boolean => isPRClosed(prState) && !prState.merged_at;
