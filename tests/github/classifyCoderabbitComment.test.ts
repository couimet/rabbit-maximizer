import { classifyCoderabbitComment } from '../../src/github/index.js';

import { getRandomString } from '@couimet/dynamic-testing';
import { beforeEach, describe, expect, it } from '@jest/globals';

describe('classifyCoderabbitComment', () => {
  let body: string;

  beforeEach(() => {
    body = getRandomString();
  });

  it("returns 'review_limited' and RATE_LIMIT marker when the body contains the rate-limit marker", () => {
    body = 'some text rate limited by coderabbit.ai more text';

    const result = classifyCoderabbitComment(body);

    expect(result).toStrictEqual({ classification: 'review_limited', matchedMarker: 'rate limited by coderabbit.ai' });
  });

  it("returns 'review_skipped' and SKIP marker when the body contains the skip marker", () => {
    body = 'some text skip review by coderabbit.ai more text';

    const result = classifyCoderabbitComment(body);

    expect(result).toStrictEqual({ classification: 'review_skipped', matchedMarker: 'skip review by coderabbit.ai' });
  });

  it("returns 'review_changes_suggested' and ACTIONABLE marker when the body contains actionable comments posted", () => {
    body = '## Actionable comments posted: some feedback';

    const result = classifyCoderabbitComment(body);

    expect(result).toStrictEqual({ classification: 'review_changes_suggested', matchedMarker: 'Actionable comments posted:' });
  });

  it("returns 'review_approved' and NO_ACTIONABLE marker when the body contains a completion signal with no actionable comments", () => {
    body = 'No actionable comments were generated in the recent review.';

    const result = classifyCoderabbitComment(body);

    expect(result).toStrictEqual({ classification: 'review_approved', matchedMarker: 'No actionable comments were generated in the recent review.' });
  });

  it("returns 'unknown' and undefined marker when the body matches none of the known markers", () => {
    const result = classifyCoderabbitComment(body);

    expect(result).toStrictEqual({ classification: 'unknown', matchedMarker: undefined });
  });

  it("returns 'unknown' and undefined marker for an empty body", () => {
    const result = classifyCoderabbitComment('');

    expect(result).toStrictEqual({ classification: 'unknown', matchedMarker: undefined });
  });

  it("returns 'review_skipped' when both rate-limit and skip markers are present (skip checked before rate-limit)", () => {
    body = 'rate limited by coderabbit.ai and also skip review by coderabbit.ai';

    const result = classifyCoderabbitComment(body);

    expect(result).toStrictEqual({ classification: 'review_skipped', matchedMarker: 'skip review by coderabbit.ai' });
  });

  it("returns 'review_skipped' when both skip and completion markers are present (skip checked before completion)", () => {
    body = 'skip review by coderabbit.ai Actionable comments posted: some feedback';

    const result = classifyCoderabbitComment(body);

    expect(result).toStrictEqual({ classification: 'review_skipped', matchedMarker: 'skip review by coderabbit.ai' });
  });

  it("returns 'review_limited' when the body contains review_stack_entry_start with a rate-limit marker (walkthrough is not a completion signal)", () => {
    body = 'rate limited by coderabbit.ai review_stack_entry_start walkthrough';

    const result = classifyCoderabbitComment(body);

    expect(result).toStrictEqual({ classification: 'review_limited', matchedMarker: 'rate limited by coderabbit.ai' });
  });

  it('returns review_limited for walkthrough+rate-limit comments without actionable/no-actionable signals', () => {
    body = 'rate limited by coderabbit.ai review_stack_entry_start some walkthrough content';

    const result = classifyCoderabbitComment(body);

    expect(result).toStrictEqual({ classification: 'review_limited', matchedMarker: 'rate limited by coderabbit.ai' });
  });
});
