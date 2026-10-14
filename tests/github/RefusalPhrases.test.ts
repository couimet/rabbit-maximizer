import { RefusalPhrases } from '../../src/github/index.js';
import { generateConfigData } from '../helpers/index.js';

import { getRandomString, getUniqueString } from '@couimet/dynamic-testing';
import { beforeEach, describe, expect, it } from '@jest/globals';

describe('RefusalPhrases', () => {
  let firstPhrase: string;
  let secondPhrase: string;
  let phrases: RefusalPhrases;

  beforeEach(() => {
    firstPhrase = getUniqueString({ prefix: 'refusal-a-' });
    secondPhrase = getUniqueString({ prefix: 'refusal-b-' });
    phrases = new RefusalPhrases(generateConfigData({ CODERABBIT_REFUSAL_PHRASES: [firstPhrase, secondPhrase] }));
  });

  it('returns the phrase when the body contains it', () => {
    expect(phrases.match(`${getRandomString()} ${firstPhrase} ${getRandomString()}`)).toBe(firstPhrase);
  });

  it('returns undefined when the body contains none of the phrases', () => {
    expect(phrases.match(getRandomString())).toBeUndefined();
  });

  it('returns undefined for an empty body', () => {
    expect(phrases.match('')).toBeUndefined();
  });

  it('returns the first configured phrase that the body contains', () => {
    expect(phrases.match(`refused: ${secondPhrase} and ${firstPhrase}`)).toBe(firstPhrase);
  });

  it('matches case-sensitively', () => {
    expect(phrases.match(firstPhrase.toUpperCase())).toBeUndefined();
  });
});
