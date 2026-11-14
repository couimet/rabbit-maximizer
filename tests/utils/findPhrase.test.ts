import { findPhrase } from '../../src/utils/index.js';

import { getRandomString, getUniqueString } from '@couimet/dynamic-testing';
import { beforeEach, describe, expect, it } from '@jest/globals';

describe('findPhrase', () => {
  let firstPhrase: string;
  let secondPhrase: string;
  let phrases: readonly string[];

  beforeEach(() => {
    firstPhrase = getUniqueString({ prefix: 'first-' });
    secondPhrase = getUniqueString({ prefix: 'second-' });
    phrases = [firstPhrase, secondPhrase];
  });

  it('returns the phrase and its offset when the body holds it', () => {
    const prefix = getRandomString();

    expect(findPhrase(`${prefix}${firstPhrase}${getRandomString()}`, phrases)).toStrictEqual({ phrase: firstPhrase, offset: prefix.length });
  });

  it('returns the phrase at offset zero when the body starts with it', () => {
    expect(findPhrase(`${firstPhrase} tail`, phrases)).toStrictEqual({ phrase: firstPhrase, offset: 0 });
  });

  it('returns the phrase that precedes the others in the list, with its own offset', () => {
    const offset = 10;

    expect(findPhrase(`${'x'.repeat(offset)}${secondPhrase} ${firstPhrase}`, phrases)).toStrictEqual({
      phrase: firstPhrase,
      offset: offset + secondPhrase.length + 1,
    });
  });

  it('honors the list order when the body holds several phrases', () => {
    const offset = 5;

    expect(findPhrase(`${'x'.repeat(offset)}${firstPhrase} ${secondPhrase}`, [secondPhrase, firstPhrase])).toStrictEqual({
      phrase: secondPhrase,
      offset: offset + firstPhrase.length + 1,
    });
  });

  it('returns the offset of the first occurrence when the body repeats the phrase', () => {
    const offset = 3;

    expect(findPhrase(`${'x'.repeat(offset)}${firstPhrase}${getRandomString()}${firstPhrase}`, phrases)).toStrictEqual({ phrase: firstPhrase, offset });
  });

  it('returns undefined when the body holds no phrase', () => {
    expect(findPhrase(getRandomString(), phrases)).toBeUndefined();
  });

  it('returns undefined when the phrase list holds nothing', () => {
    expect(findPhrase(firstPhrase, [])).toBeUndefined();
  });

  it('returns undefined for an empty body', () => {
    expect(findPhrase('', phrases)).toBeUndefined();
  });

  it('matches case-sensitively', () => {
    expect(findPhrase(firstPhrase.toUpperCase(), phrases)).toBeUndefined();
  });
});
