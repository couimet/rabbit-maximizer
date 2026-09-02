import { CodeRabbitCommentType } from '../../src/domain.js';
import { expectedHeadShaForSourceCommentType } from '../../src/utils/index.js';

import { getUniqueString } from '@couimet/dynamic-testing';
import { describe, expect, it } from '@jest/globals';

describe('expectedHeadShaForSourceCommentType', () => {
  it('returns the head sha for a review_skipped source comment', () => {
    const headSha = getUniqueString({ prefix: 'sha-' });

    expect(expectedHeadShaForSourceCommentType(CodeRabbitCommentType.review_skipped, headSha)).toBe(headSha);
  });

  it('returns undefined for a non-review_skipped source comment', () => {
    const headSha = getUniqueString({ prefix: 'sha-' });

    expect(expectedHeadShaForSourceCommentType(CodeRabbitCommentType.review_limited, headSha)).toBeUndefined();
  });

  it('returns undefined when no source comment type is known', () => {
    const headSha = getUniqueString({ prefix: 'sha-' });

    expect(expectedHeadShaForSourceCommentType(undefined, headSha)).toBeUndefined();
  });

  it('returns undefined when the head sha is unknown even for review_skipped', () => {
    expect(expectedHeadShaForSourceCommentType(CodeRabbitCommentType.review_skipped, undefined)).toBeUndefined();
  });
});
