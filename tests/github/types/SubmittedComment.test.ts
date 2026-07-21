import { SubmittedComment } from '../../../src/github/types/SubmittedComment.js';

import { describe, expect, it } from '@jest/globals';

const USER_LOGIN = 'octocat';
const BODY = 'This is a review comment';

describe('SubmittedComment.from', () => {
  it('maps all fields when present', () => {
    const raw = { user: { login: USER_LOGIN }, body: BODY };

    const result = SubmittedComment.from(raw);

    expect(result).toStrictEqual(SubmittedComment.create({ userLogin: USER_LOGIN, body: BODY }));
  });

  it('maps null user to undefined userLogin', () => {
    const raw = { user: null, body: BODY };

    const result = SubmittedComment.from(raw);

    expect(result).toStrictEqual(SubmittedComment.create({ userLogin: undefined, body: BODY }));
  });

  it('maps null body to undefined body', () => {
    const raw = { user: { login: USER_LOGIN }, body: null };

    const result = SubmittedComment.from(raw);

    expect(result).toStrictEqual(SubmittedComment.create({ userLogin: USER_LOGIN, body: undefined }));
  });

  it('maps undefined body to undefined body', () => {
    const raw = { user: { login: USER_LOGIN } };

    const result = SubmittedComment.from(raw);

    expect(result).toStrictEqual(SubmittedComment.create({ userLogin: USER_LOGIN, body: undefined }));
  });
});
