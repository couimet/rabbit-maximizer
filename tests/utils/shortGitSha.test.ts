import { shortGitSha } from '../../src/utils/shortGitSha.js';

import { getRandomHexString } from '@couimet/dynamic-testing';
import { beforeEach, describe, expect, it } from '@jest/globals';

const SHORT_SHA_LENGTH = 7;
const FULL_SHA_LENGTH = 40;

describe('shortGitSha', () => {
  let shortSha: string;
  let fullSha: string;

  beforeEach(() => {
    shortSha = getRandomHexString(SHORT_SHA_LENGTH);
    fullSha = `${shortSha}${getRandomHexString(FULL_SHA_LENGTH - SHORT_SHA_LENGTH)}`;
  });

  it('shortens a full commit to the length of the published image tag', () => {
    expect(shortGitSha(fullSha)).toBe(shortSha);
  });

  it('leaves a commit that already holds the short form unchanged', () => {
    expect(shortGitSha(shortSha)).toBe(shortSha);
  });

  it('ignores surrounding whitespace', () => {
    expect(shortGitSha(` ${fullSha} `)).toBe(shortSha);
  });

  it('returns unknown when the value is absent', () => {
    expect(shortGitSha(undefined)).toBe('unknown');
  });

  it('returns unknown when the value is empty', () => {
    expect(shortGitSha('')).toBe('unknown');
  });
});
