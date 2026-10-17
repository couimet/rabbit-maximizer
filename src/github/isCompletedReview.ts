import { findPhrase } from '../utils/index.js';

/** True when the body holds one of the configured verdict phrases. */
export const isCompletedReview = (body: string, phrases: readonly string[]): boolean => findPhrase(body, phrases) !== undefined;
