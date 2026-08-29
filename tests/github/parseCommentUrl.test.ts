import { parseCommentUrl } from '../../src/github/index.js';

import { getUniqueInt, getUniqueString } from '@couimet/dynamic-testing';
import { describe, expect, it } from '@jest/globals';

describe('parseCommentUrl', () => {
  it('extracts owner, repo, and commentId from a pull URL', () => {
    const owner = getUniqueString({ charset: 'alpha' });
    const repo = getUniqueString({ charset: 'alpha' });
    const prNumber = getUniqueInt();
    const commentId = getUniqueInt();
    const url = `https://github.com/${owner}/${repo}/pull/${prNumber}#issuecomment-${commentId}`;

    const result = parseCommentUrl(url);

    expect(result).toStrictEqual({ owner, repo, commentId });
  });

  it('extracts owner, repo, and commentId from an issues URL', () => {
    const owner = getUniqueString({ charset: 'alpha' });
    const repo = getUniqueString({ charset: 'alpha' });
    const prNumber = getUniqueInt();
    const commentId = getUniqueInt();
    const url = `https://github.com/${owner}/${repo}/issues/${prNumber}#issuecomment-${commentId}`;

    const result = parseCommentUrl(url);

    expect(result).toStrictEqual({ owner, repo, commentId });
  });

  it('returns undefined for a non-GitHub URL', () => {
    expect(parseCommentUrl('https://gitlab.com/owner/repo/issues/1#issuecomment-123')).toBeUndefined();
  });

  it('returns undefined for a malformed URL missing the comment fragment', () => {
    const url = 'https://github.com/owner/repo/pull/1';
    expect(parseCommentUrl(url)).toBeUndefined();
  });
});
