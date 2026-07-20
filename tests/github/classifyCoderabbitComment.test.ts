import { classifyCoderabbitComment } from '../../src/github/classifyCoderabbitComment.js';

import { getRandomString } from '@couimet/dynamic-testing';
import { beforeEach, describe, expect, it } from '@jest/globals';

describe('classifyCoderabbitComment', () => {
  let body: string;

  beforeEach(() => {
    body = getRandomString();
  });

  it("returns 'review_limited' when the body contains the rate-limit marker", () => {
    body = `some text rate limited by coderabbit.ai more text`;

    const result = classifyCoderabbitComment(body);

    expect(result).toBe('review_limited');
  });

  it("returns 'review_skipped' when the body contains the skip marker", () => {
    body = `some text skip review by coderabbit.ai more text`;

    const result = classifyCoderabbitComment(body);

    expect(result).toBe('review_skipped');
  });

  it("returns 'review_changes_suggested' when the body contains actionable comments posted", () => {
    body = '## Actionable comments posted: some feedback';

    const result = classifyCoderabbitComment(body);

    expect(result).toBe('review_changes_suggested');
  });

  it("returns 'review_approved' when the body contains a completion signal (no actionable comments)", () => {
    body = 'No actionable comments were generated in the recent review.';

    const result = classifyCoderabbitComment(body);

    expect(result).toBe('review_approved');
  });

  it("returns 'unknown' when the body matches none of the known markers", () => {
    const result = classifyCoderabbitComment(body);

    expect(result).toBe('unknown');
  });

  it("returns 'unknown' for an empty body", () => {
    const result = classifyCoderabbitComment('');

    expect(result).toBe('unknown');
  });

  it("returns 'review_limited' when both rate-limit and skip markers are present (rate-limit checked first)", () => {
    body = `rate limited by coderabbit.ai and also skip review by coderabbit.ai`;

    const result = classifyCoderabbitComment(body);

    expect(result).toBe('review_limited');
  });

  it("returns 'review_skipped' when both skip and completion markers are present (skip checked before completion)", () => {
    body = `skip review by coderabbit.ai Actionable comments posted: some feedback`;

    const result = classifyCoderabbitComment(body);

    expect(result).toBe('review_skipped');
  });
});
