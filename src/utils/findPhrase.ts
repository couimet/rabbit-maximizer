import type { MatchedText } from '../types/index.js';

/**
 * Find the first phrase of the list that the body holds, together with its offset.
 * The caller controls the precedence, because the list order decides the result.
 * The test is a case-sensitive substring test.
 */
export const findPhrase = (body: string, phrases: readonly string[]): MatchedText | undefined => {
  for (const phrase of phrases) {
    const offset = body.indexOf(phrase);
    if (offset >= 0) return { phrase, offset };
  }
  return undefined;
};
