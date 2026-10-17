import { findPhrase } from '../utils/index.js';

/** True when the body holds one of the configured approval phrases. */
export const isApprovalReviewSignal = (body: string, phrases: readonly string[]): boolean => findPhrase(body, phrases) !== undefined;
