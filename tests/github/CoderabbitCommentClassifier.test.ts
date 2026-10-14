import type { CoderabbitCommentClassifier } from '../../src/github/index.js';
import { createCoderabbitCommentClassifier } from '../helpers/index.js';

import { getRandomString, getUniqueString } from '@couimet/dynamic-testing';
import { beforeEach, describe, expect, it } from '@jest/globals';

describe('CoderabbitCommentClassifier', () => {
  let body: string;
  let firstPhrase: string;
  let secondPhrase: string;
  let classifier: CoderabbitCommentClassifier;

  beforeEach(() => {
    body = getRandomString();
    firstPhrase = getUniqueString({ prefix: 'refusal-a-' });
    secondPhrase = getUniqueString({ prefix: 'refusal-b-' });
    classifier = createCoderabbitCommentClassifier({ CODERABBIT_REFUSAL_PHRASES: [firstPhrase, secondPhrase] });
  });

  it("returns 'review_limited' and RATE_LIMIT marker when the body contains the rate-limit marker", () => {
    const result = classifier.classify('some text rate limited by coderabbit.ai more text');

    expect(result).toStrictEqual({ classification: 'review_limited', matchedMarker: 'rate limited by coderabbit.ai', matchedPhrase: undefined });
  });

  it("returns 'review_skipped' and SKIP marker when the body contains the skip marker", () => {
    const result = classifier.classify('some text skip review by coderabbit.ai more text');

    expect(result).toStrictEqual({ classification: 'review_skipped', matchedMarker: 'skip review by coderabbit.ai', matchedPhrase: undefined });
  });

  it("returns 'review_changes_suggested' and ACTIONABLE marker when the body contains actionable comments posted", () => {
    const result = classifier.classify('## Actionable comments posted: some feedback');

    expect(result).toStrictEqual({ classification: 'review_changes_suggested', matchedMarker: 'Actionable comments posted:', matchedPhrase: undefined });
  });

  it("returns 'review_approved' and NO_ACTIONABLE marker when the body contains a completion signal with no actionable comments", () => {
    const result = classifier.classify('No actionable comments were generated in the recent review.');

    expect(result).toStrictEqual({
      classification: 'review_approved',
      matchedMarker: 'No actionable comments were generated in the recent review.',
      matchedPhrase: undefined,
    });
  });

  it("returns 'unknown' and undefined marker when the body matches none of the known markers", () => {
    const result = classifier.classify(body);

    expect(result).toStrictEqual({ classification: 'unknown', matchedMarker: undefined, matchedPhrase: undefined });
  });

  it("returns 'unknown' and undefined marker for an empty body", () => {
    const result = classifier.classify('');

    expect(result).toStrictEqual({ classification: 'unknown', matchedMarker: undefined, matchedPhrase: undefined });
  });

  it("returns 'review_skipped' when both rate-limit and skip markers are present (skip checked before rate-limit)", () => {
    const result = classifier.classify('rate limited by coderabbit.ai and also skip review by coderabbit.ai');

    expect(result).toStrictEqual({ classification: 'review_skipped', matchedMarker: 'skip review by coderabbit.ai', matchedPhrase: undefined });
  });

  it("returns 'review_skipped' when both skip and completion markers are present (skip checked before completion)", () => {
    const result = classifier.classify('skip review by coderabbit.ai Actionable comments posted: some feedback');

    expect(result).toStrictEqual({ classification: 'review_skipped', matchedMarker: 'skip review by coderabbit.ai', matchedPhrase: undefined });
  });

  it("returns 'review_limited' when the body contains review_stack_entry_start with a rate-limit marker (walkthrough is not a completion signal)", () => {
    const result = classifier.classify('rate limited by coderabbit.ai review_stack_entry_start walkthrough');

    expect(result).toStrictEqual({ classification: 'review_limited', matchedMarker: 'rate limited by coderabbit.ai', matchedPhrase: undefined });
  });

  it("returns 'review_refused' with the matched phrase when the body carries a configured refusal phrase", () => {
    const result = classifier.classify(`This PR was authored by a bot ${firstPhrase}. Ask an organization administrator to assign a seat to the bot.`);

    expect(result).toStrictEqual({ classification: 'review_refused', matchedMarker: undefined, matchedPhrase: firstPhrase });
  });

  it("returns 'review_refused' when the refusal phrase sits beside the skip marker (refusal checked before skip)", () => {
    const result = classifier.classify(`This PR was authored by a bot ${firstPhrase}.\n\nskip review by coderabbit.ai`);

    expect(result).toStrictEqual({ classification: 'review_refused', matchedMarker: undefined, matchedPhrase: firstPhrase });
  });

  it("returns 'review_refused' when the refusal phrase sits beside a completion signal (refusal checked before completion)", () => {
    const result = classifier.classify(`${firstPhrase}\n\nActionable comments posted: some feedback`);

    expect(result).toStrictEqual({ classification: 'review_refused', matchedMarker: undefined, matchedPhrase: firstPhrase });
  });

  it('returns the first configured phrase that the body contains when the list holds several phrases', () => {
    const result = classifier.classify(`refused: ${secondPhrase} and ${firstPhrase}`);

    expect(result).toStrictEqual({ classification: 'review_refused', matchedMarker: undefined, matchedPhrase: firstPhrase });
  });

  it('lets the configured phrase list decide the outcome: an unlisted phrase leaves the skip marker in charge', () => {
    const result = classifier.classify(`${firstPhrase.toUpperCase()}\n\nskip review by coderabbit.ai`);

    expect(result).toStrictEqual({ classification: 'review_skipped', matchedMarker: 'skip review by coderabbit.ai', matchedPhrase: undefined });
  });

  it('matches the refusal phrase case-sensitively', () => {
    const result = classifier.classify(firstPhrase.toUpperCase());

    expect(result).toStrictEqual({ classification: 'unknown', matchedMarker: undefined, matchedPhrase: undefined });
  });
});
