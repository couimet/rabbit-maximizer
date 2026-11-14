import { isAcknowledgementComment, REVIEW_BOT_LOGIN, SubmittedComment } from '../../src/github/index.js';

import { getRandomString, getUniqueString } from '@couimet/dynamic-testing';
import { beforeEach, describe, expect, it } from '@jest/globals';

const BOT_LOGIN = REVIEW_BOT_LOGIN;
const OTHER_LOGIN = 'some-other-bot[bot]';

describe('isAcknowledgementComment', () => {
  let phrase: string;
  let phrases: readonly string[];

  beforeEach(() => {
    phrase = getUniqueString({ prefix: 'acknowledgement-' });
    phrases = [phrase];
  });

  it('returns true for a matching acknowledgement comment', () => {
    const comment = SubmittedComment.create({ userLogin: BOT_LOGIN, body: `<!-- ${phrase} -->` });

    expect(isAcknowledgementComment(comment, phrases)).toBe(true);
  });

  it('returns false when userLogin does not match CodeRabbit bot', () => {
    const comment = SubmittedComment.create({ userLogin: OTHER_LOGIN, body: `<!-- ${phrase} -->` });

    expect(isAcknowledgementComment(comment, phrases)).toBe(false);
  });

  it('returns false when userLogin is undefined', () => {
    const comment = SubmittedComment.create({ userLogin: undefined, body: `<!-- ${phrase} -->` });

    expect(isAcknowledgementComment(comment, phrases)).toBe(false);
  });

  it('returns false when the body holds no configured phrase', () => {
    const comment = SubmittedComment.create({ userLogin: BOT_LOGIN, body: getRandomString() });

    expect(isAcknowledgementComment(comment, phrases)).toBe(false);
  });

  it('returns false when the phrase list holds nothing', () => {
    const comment = SubmittedComment.create({ userLogin: BOT_LOGIN, body: `<!-- ${phrase} -->` });

    expect(isAcknowledgementComment(comment, [])).toBe(false);
  });

  it('returns false when body is undefined', () => {
    const comment = SubmittedComment.create({ userLogin: BOT_LOGIN, body: undefined });

    expect(isAcknowledgementComment(comment, phrases)).toBe(false);
  });
});
