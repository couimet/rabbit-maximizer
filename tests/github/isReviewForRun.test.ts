import { isReviewForRun } from '../../src/github/isReviewForRun.js';
import { SubmittedReview } from '../../src/github/SubmittedReview.js';

import { getUniqueString } from '@couimet/dynamic-testing';
import { describe, expect, it } from '@jest/globals';

const makeReview = (body: string | undefined, commitId: string | undefined): SubmittedReview =>
  SubmittedReview.create({ userLogin: 'coderabbitai[bot]', body, submittedAt: undefined, commitId });

describe('isReviewForRun', () => {
  describe('commit tier', () => {
    it('accepts a review whose commit matches the expected head even when its run differs', () => {
      const runId = getUniqueString({ prefix: 'run-' });
      const headSha = getUniqueString({ prefix: 'sha-' });
      const review = makeReview(`**Run ID**: \`${getUniqueString({ prefix: 'run-' })}\``, headSha);

      expect(isReviewForRun(review, runId, headSha)).toBe(true);
    });

    it('accepts a review whose commit matches the PR head when no run is expected', () => {
      const headSha = getUniqueString({ prefix: 'sha-' });
      const review = makeReview(undefined, headSha);

      expect(isReviewForRun(review, undefined, headSha)).toBe(true);
    });

    it('rejects a review whose commit differs from the PR head when no run is expected', () => {
      const headSha = getUniqueString({ prefix: 'sha-' });
      const review = makeReview(undefined, getUniqueString({ prefix: 'sha-' }));

      expect(isReviewForRun(review, undefined, headSha)).toBe(false);
    });

    it('rejects a review whose commit differs from the PR head when its run also differs', () => {
      const runId = getUniqueString({ prefix: 'run-' });
      const headSha = getUniqueString({ prefix: 'sha-' });
      const review = makeReview(`**Run ID**: \`${getUniqueString({ prefix: 'run-' })}\``, getUniqueString({ prefix: 'sha-' }));

      expect(isReviewForRun(review, runId, headSha)).toBe(false);
    });

    it('accepts a review whose run matches even when its commit differs', () => {
      const runId = getUniqueString({ prefix: 'run-' });
      const headSha = getUniqueString({ prefix: 'sha-' });
      const review = makeReview(`**Run ID**: \`${runId}\``, getUniqueString({ prefix: 'sha-' }));

      expect(isReviewForRun(review, runId, headSha)).toBe(true);
    });

    it('rejects a review with no commit when a head SHA is expected', () => {
      const headSha = getUniqueString({ prefix: 'sha-' });
      const review = makeReview('No actionable comments were generated in the recent review.', undefined);

      expect(isReviewForRun(review, undefined, headSha)).toBe(false);
    });
  });

  describe('run tier', () => {
    it('accepts a review whose body carries the expected run ID', () => {
      const runId = getUniqueString({ prefix: 'run-' });
      const review = makeReview(`**Run ID**: \`${runId}\`\n\nreview body`, undefined);

      expect(isReviewForRun(review, runId, undefined)).toBe(true);
    });

    it('rejects a review with no run ID line when a run is expected', () => {
      const runId = getUniqueString({ prefix: 'run-' });
      const review = makeReview('rate limited by coderabbit.ai', undefined);

      expect(isReviewForRun(review, runId, undefined)).toBe(false);
    });

    it('accepts a review with no commit when the expected head is undefined', () => {
      const review = makeReview('No actionable comments were generated in the recent review.', undefined);

      expect(isReviewForRun(review, undefined, undefined)).toBe(true);
    });
  });
});
