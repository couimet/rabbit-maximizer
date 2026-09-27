import { parseImageTagNames } from '../../src/utils/parseImageTagNames.js';

import { getUniqueString } from '@couimet/dynamic-testing';
import { beforeEach, describe, expect, it } from '@jest/globals';

describe('parseImageTagNames', () => {
  let imageRepo: string;
  let versionTag: string;
  let shortShaTag: string;

  beforeEach(() => {
    imageRepo = getUniqueString({ prefix: 'ghcr.io/owner/repo-' });
    versionTag = getUniqueString({ prefix: 'tag-' });
    shortShaTag = getUniqueString({ prefix: 'sha-' });
  });

  it('reduces a reference list to the tag names', () => {
    expect(parseImageTagNames(`${imageRepo}:${versionTag},${imageRepo}:${shortShaTag}`)).toBe(`${versionTag},${shortShaTag}`);
  });

  it('keeps a single reference that holds no tag separator', () => {
    expect(parseImageTagNames(versionTag)).toBe(versionTag);
  });

  it('keeps a registry port out of the tag name', () => {
    expect(parseImageTagNames(`localhost:5000/rabbit-maximizer:${versionTag}`)).toBe(versionTag);
  });

  it('returns an empty string for an empty list', () => {
    expect(parseImageTagNames('')).toBe('');
  });
});
