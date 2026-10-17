import { phraseList } from '../../src/schemas/phraseList.js';

import { getUniqueString } from '@couimet/dynamic-testing';
import { describe, expect, it } from '@jest/globals';

const CONFIG_KEY = 'CODERABBIT_PAUSE_PHRASES';
const FALLBACK = ['review paused by coderabbit.ai'];

describe('phraseList', () => {
  it('parses a list of phrases', () => {
    const phrases = [getUniqueString(), getUniqueString()];

    expect(phraseList(CONFIG_KEY, FALLBACK).parse(phrases)).toStrictEqual(phrases);
  });

  it('applies the fallback when the value is absent', () => {
    expect(phraseList(CONFIG_KEY, FALLBACK).parse(undefined)).toStrictEqual(FALLBACK);
  });

  it('rejects an empty array and names the key in the message', () => {
    const { error } = phraseList(CONFIG_KEY, FALLBACK).safeParse([]);

    expect(error?.issues.map((issue) => issue.message)).toStrictEqual(['CODERABBIT_PAUSE_PHRASES must have at least one entry']);
  });

  it('rejects a non-list value and names the key in the message', () => {
    const { error } = phraseList(CONFIG_KEY, FALLBACK).safeParse('review paused by coderabbit.ai');

    expect(error?.issues.map((issue) => issue.message)).toStrictEqual(['CODERABBIT_PAUSE_PHRASES must be a list of strings']);
  });

  it('rejects an empty entry and names the key in the message', () => {
    const { error } = phraseList(CONFIG_KEY, FALLBACK).safeParse(['']);

    expect(error?.issues.map((issue) => issue.message)).toStrictEqual(['CODERABBIT_PAUSE_PHRASES entries must be non-empty']);
  });
});
