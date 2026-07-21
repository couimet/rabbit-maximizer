import { SubmittedReview } from '../../../src/github/types/SubmittedReview.js';

import { describe, expect, it } from '@jest/globals';

const OCTOCAT = 'octocat';
const REVIEW_TIMESTAMP = '2024-01-15T10:00:00Z';

describe('SubmittedReview', () => {
  describe('from', () => {
    it('maps all fields from raw data', () => {
      const raw = {
        user: { login: OCTOCAT },
        body: 'Looks good to me',
        submitted_at: REVIEW_TIMESTAMP,
        state: 'APPROVED',
      };
      const result = SubmittedReview.from(raw);

      expect(result).toStrictEqual(
        SubmittedReview.create({
          userLogin: OCTOCAT,
          body: 'Looks good to me',
          submittedAt: REVIEW_TIMESTAMP,
          state: 'APPROVED',
        }),
      );
    });

    it('maps null user to undefined userLogin', () => {
      const raw = { user: null, body: 'OK', submitted_at: REVIEW_TIMESTAMP, state: 'COMMENTED' };
      const result = SubmittedReview.from(raw);

      expect(result).toStrictEqual(
        SubmittedReview.create({
          userLogin: undefined,
          body: 'OK',
          submittedAt: REVIEW_TIMESTAMP,
          state: 'COMMENTED',
        }),
      );
    });

    it('maps null body to undefined body', () => {
      const raw = { user: { login: OCTOCAT }, body: null, submitted_at: REVIEW_TIMESTAMP, state: 'APPROVED' };
      const result = SubmittedReview.from(raw);

      expect(result).toStrictEqual(
        SubmittedReview.create({
          userLogin: OCTOCAT,
          body: undefined,
          submittedAt: REVIEW_TIMESTAMP,
          state: 'APPROVED',
        }),
      );
    });

    it('maps null submitted_at to undefined submittedAt', () => {
      const raw = { user: { login: OCTOCAT }, body: 'Looks good', submitted_at: null, state: 'APPROVED' };
      const result = SubmittedReview.from(raw);

      expect(result).toStrictEqual(
        SubmittedReview.create({
          userLogin: OCTOCAT,
          body: 'Looks good',
          submittedAt: undefined,
          state: 'APPROVED',
        }),
      );
    });

    it('maps missing state to undefined state', () => {
      const raw = { user: { login: OCTOCAT }, body: 'Looks good', submitted_at: REVIEW_TIMESTAMP };
      const result = SubmittedReview.from(raw);

      expect(result).toStrictEqual(
        SubmittedReview.create({
          userLogin: OCTOCAT,
          body: 'Looks good',
          submittedAt: REVIEW_TIMESTAMP,
          state: undefined,
        }),
      );
    });

    it('maps partial objects with all fields missing', () => {
      const raw = { user: null, body: null, submitted_at: null };
      const result = SubmittedReview.from(raw);

      expect(result).toStrictEqual(
        SubmittedReview.create({
          userLogin: undefined,
          body: undefined,
          submittedAt: undefined,
          state: undefined,
        }),
      );
    });
  });
});
