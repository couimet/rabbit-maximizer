import { isAcknowledgementComment } from '../../src/github/isAcknowledgementComment.js';
import { SubmittedComment } from '../../src/github/types/index.js';
import { REVIEW_BOT_ACKNOWLEDGEMENT_MARKER, REVIEW_BOT_LOGIN } from '../../src/types/coderabbit.js';

import { getUniqueString } from '@couimet/dynamic-testing';
import { describe, expect, it } from '@jest/globals';

const ACKNOWLEDGEMENT_MARKER = REVIEW_BOT_ACKNOWLEDGEMENT_MARKER;
const BOT_LOGIN = REVIEW_BOT_LOGIN;
const OTHER_LOGIN = 'some-other-bot[bot]';

describe('isAcknowledgementComment', () => {
  it('returns true for a matching acknowledgement comment', () => {
    const body = `<!-- ${ACKNOWLEDGEMENT_MARKER} -->`;
    const comment = SubmittedComment.create({ userLogin: BOT_LOGIN, body });

    expect(isAcknowledgementComment(comment)).toBe(true);
  });

  it('returns false when userLogin does not match CodeRabbit bot', () => {
    const body = `<!-- ${ACKNOWLEDGEMENT_MARKER} -->`;
    const comment = SubmittedComment.create({ userLogin: OTHER_LOGIN, body });

    expect(isAcknowledgementComment(comment)).toBe(false);
  });

  it('returns false when userLogin is undefined', () => {
    const body = `<!-- ${ACKNOWLEDGEMENT_MARKER} -->`;
    const comment = SubmittedComment.create({ userLogin: undefined, body });

    expect(isAcknowledgementComment(comment)).toBe(false);
  });

  it('returns false when body does not contain acknowledgement marker', () => {
    const comment = SubmittedComment.create({ userLogin: BOT_LOGIN, body: getUniqueString({ prefix: 'irrelevant-' }) });

    expect(isAcknowledgementComment(comment)).toBe(false);
  });

  it('returns false when body is undefined', () => {
    const comment = SubmittedComment.create({ userLogin: BOT_LOGIN, body: undefined });

    expect(isAcknowledgementComment(comment)).toBe(false);
  });
});
