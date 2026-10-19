import { parseImageTagNames } from '../../src/utils/parseImageTagNames.js';

import { getRandomHexString, getUniqueString } from '@couimet/dynamic-testing';
import { beforeEach, describe, expect, it } from '@jest/globals';

const DIGEST_LENGTH = 64;

describe('parseImageTagNames', () => {
  let imageRepo: string;
  let versionTag: string;
  let shortShaTag: string;
  let digest: string;

  beforeEach(() => {
    imageRepo = getUniqueString({ prefix: 'ghcr.io/owner/repo-' });
    versionTag = getUniqueString({ prefix: 'tag-' });
    shortShaTag = getUniqueString({ prefix: 'sha-' });
    digest = getRandomHexString(DIGEST_LENGTH);
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

  it('drops a registry port that holds no tag', () => {
    expect(parseImageTagNames('localhost:5000/rabbit-maximizer')).toBe('');
  });

  it('drops a digest reference', () => {
    expect(parseImageTagNames(`${imageRepo}@sha256:${digest}`)).toBe('');
  });

  it('trims padding around a reference', () => {
    expect(parseImageTagNames(`${imageRepo}:${versionTag}, ${imageRepo}:${shortShaTag}`)).toBe(`${versionTag},${shortShaTag}`);
  });

  it('returns an empty string for an empty list', () => {
    expect(parseImageTagNames('')).toBe('');
  });
});
