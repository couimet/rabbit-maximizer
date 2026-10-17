import type { CoderabbitCommentClassifier } from '../../src/github/index.js';
import { createCoderabbitCommentClassifier } from '../helpers/index.js';

import { getRandomString, getUniqueString } from '@couimet/dynamic-testing';
import { beforeEach, describe, expect, it } from '@jest/globals';

/**
 * Joins the phrases with random filler, so a test reads the offset of each phrase
 * from the returned list instead of hardcoding a body shape.
 */
const bodyWith = (...phrases: readonly string[]): { readonly body: string; readonly offsets: readonly number[] } => {
  const parts: string[] = [];
  const offsets: number[] = [];
  let cursor = 0;

  for (const phrase of phrases) {
    const filler = getRandomString();
    parts.push(filler, phrase);
    cursor += filler.length;
    offsets.push(cursor);
    cursor += phrase.length;
  }

  return { body: parts.join(''), offsets };
};

describe('CoderabbitCommentClassifier', () => {
  let acknowledgement: string;
  let approval: string;
  let changesSuggested: string;
  let pause: string;
  let rateLimit: string;
  let refusal: string;
  let secondRefusal: string;
  let skip: string;
  let walkthrough: string;
  let classifier: CoderabbitCommentClassifier;

  beforeEach(() => {
    acknowledgement = getUniqueString({ prefix: 'acknowledgement-' });
    approval = getUniqueString({ prefix: 'approval-' });
    changesSuggested = getUniqueString({ prefix: 'changes-' });
    pause = getUniqueString({ prefix: 'pause-' });
    rateLimit = getUniqueString({ prefix: 'rate-limit-' });
    refusal = getUniqueString({ prefix: 'refusal-' });
    secondRefusal = getUniqueString({ prefix: 'second-refusal-' });
    skip = getUniqueString({ prefix: 'skip-' });
    walkthrough = getUniqueString({ prefix: 'walkthrough-' });
    classifier = createCoderabbitCommentClassifier({
      CODERABBIT_ACKNOWLEDGEMENT_PHRASES: [acknowledgement],
      CODERABBIT_APPROVAL_PHRASES: [approval],
      CODERABBIT_CHANGES_SUGGESTED_PHRASES: [changesSuggested],
      CODERABBIT_PAUSE_PHRASES: [pause],
      CODERABBIT_RATE_LIMIT_PHRASES: [rateLimit],
      CODERABBIT_REFUSAL_PHRASES: [refusal, secondRefusal],
      CODERABBIT_SKIP_PHRASES: [skip],
      CODERABBIT_WALKTHROUGH_PHRASES: [walkthrough],
    });
  });

  it("returns 'review_limited' with the configured rate-limit phrase", () => {
    const { body, offsets } = bodyWith(rateLimit);

    expect(classifier.classify(body)).toStrictEqual({ classification: 'review_limited', matchedPhrase: rateLimit, matchedOffset: offsets[0] });
  });

  it("returns 'review_skipped' with the configured skip phrase", () => {
    const { body, offsets } = bodyWith(skip);

    expect(classifier.classify(body)).toStrictEqual({ classification: 'review_skipped', matchedPhrase: skip, matchedOffset: offsets[0] });
  });

  it("returns 'review_skipped' with the configured pause phrase", () => {
    const { body, offsets } = bodyWith(pause);

    expect(classifier.classify(body)).toStrictEqual({ classification: 'review_skipped', matchedPhrase: pause, matchedOffset: offsets[0] });
  });

  it("returns 'review_changes_suggested' with the configured changes-suggested phrase", () => {
    const { body, offsets } = bodyWith(changesSuggested);

    expect(classifier.classify(body)).toStrictEqual({ classification: 'review_changes_suggested', matchedPhrase: changesSuggested, matchedOffset: offsets[0] });
  });

  it("returns 'review_approved' with the configured approval phrase", () => {
    const { body, offsets } = bodyWith(approval);

    expect(classifier.classify(body)).toStrictEqual({ classification: 'review_approved', matchedPhrase: approval, matchedOffset: offsets[0] });
  });

  it("returns 'review_refused' with the configured refusal phrase", () => {
    const { body, offsets } = bodyWith(refusal);

    expect(classifier.classify(body)).toStrictEqual({ classification: 'review_refused', matchedPhrase: refusal, matchedOffset: offsets[0] });
  });

  it("returns 'unknown' with no match when the body holds a configured phrase of no tier", () => {
    const { body } = bodyWith(getRandomString());

    expect(classifier.classify(body)).toStrictEqual({ classification: 'unknown', matchedPhrase: undefined, matchedOffset: undefined });
  });

  it("returns 'unknown' with no match when the body holds only the walkthrough phrase", () => {
    const { body } = bodyWith(walkthrough);

    expect(classifier.classify(body)).toStrictEqual({ classification: 'unknown', matchedPhrase: undefined, matchedOffset: undefined });
  });

  it("returns 'unknown' with no match when the body holds only the acknowledgement phrase", () => {
    const { body } = bodyWith(acknowledgement);

    expect(classifier.classify(body)).toStrictEqual({ classification: 'unknown', matchedPhrase: undefined, matchedOffset: undefined });
  });

  it("returns 'unknown' with no match for an empty body", () => {
    expect(classifier.classify('')).toStrictEqual({ classification: 'unknown', matchedPhrase: undefined, matchedOffset: undefined });
  });

  it('returns the first configured phrase of a tier when the body holds two of them', () => {
    const { body, offsets } = bodyWith(secondRefusal, refusal);

    expect(classifier.classify(body)).toStrictEqual({ classification: 'review_refused', matchedPhrase: refusal, matchedOffset: offsets[1] });
  });

  it('matches a configured phrase case-sensitively', () => {
    expect(classifier.classify(refusal.toUpperCase())).toStrictEqual({ classification: 'unknown', matchedPhrase: undefined, matchedOffset: undefined });
  });

  it("prefers 'review_refused' over the skip tier", () => {
    const { body, offsets } = bodyWith(skip, refusal);

    expect(classifier.classify(body)).toStrictEqual({ classification: 'review_refused', matchedPhrase: refusal, matchedOffset: offsets[1] });
  });

  it("prefers 'review_refused' over the completion tier", () => {
    const { body, offsets } = bodyWith(changesSuggested, refusal);

    expect(classifier.classify(body)).toStrictEqual({ classification: 'review_refused', matchedPhrase: refusal, matchedOffset: offsets[1] });
  });

  it("prefers 'review_refused' over the pause tier", () => {
    const { body, offsets } = bodyWith(pause, refusal);

    expect(classifier.classify(body)).toStrictEqual({ classification: 'review_refused', matchedPhrase: refusal, matchedOffset: offsets[1] });
  });

  it("prefers 'review_refused' over the rate-limit tier", () => {
    const { body, offsets } = bodyWith(rateLimit, refusal);

    expect(classifier.classify(body)).toStrictEqual({ classification: 'review_refused', matchedPhrase: refusal, matchedOffset: offsets[1] });
  });

  it('prefers the skip tier over the completion tier', () => {
    const { body, offsets } = bodyWith(changesSuggested, skip);

    expect(classifier.classify(body)).toStrictEqual({ classification: 'review_skipped', matchedPhrase: skip, matchedOffset: offsets[1] });
  });

  it('prefers the skip tier over the pause tier', () => {
    const { body, offsets } = bodyWith(pause, skip);

    expect(classifier.classify(body)).toStrictEqual({ classification: 'review_skipped', matchedPhrase: skip, matchedOffset: offsets[1] });
  });

  it('prefers the skip tier over the rate-limit tier', () => {
    const { body, offsets } = bodyWith(rateLimit, skip);

    expect(classifier.classify(body)).toStrictEqual({ classification: 'review_skipped', matchedPhrase: skip, matchedOffset: offsets[1] });
  });

  it('prefers the completion tier over the pause tier', () => {
    const { body, offsets } = bodyWith(pause, changesSuggested);

    expect(classifier.classify(body)).toStrictEqual({ classification: 'review_changes_suggested', matchedPhrase: changesSuggested, matchedOffset: offsets[1] });
  });

  it('prefers the completion tier over the rate-limit tier', () => {
    const { body, offsets } = bodyWith(rateLimit, approval);

    expect(classifier.classify(body)).toStrictEqual({ classification: 'review_approved', matchedPhrase: approval, matchedOffset: offsets[1] });
  });

  it('prefers the pause tier over the rate-limit tier', () => {
    const { body, offsets } = bodyWith(rateLimit, pause);

    expect(classifier.classify(body)).toStrictEqual({ classification: 'review_skipped', matchedPhrase: pause, matchedOffset: offsets[1] });
  });
});
