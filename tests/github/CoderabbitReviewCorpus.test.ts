import { isApprovalReviewSignal, isMatchingCompletedReview, SubmittedReview } from '../../src/github/index.js';
import { findPhrase } from '../../src/utils/index.js';
import { createCoderabbitMarkers } from '../helpers/index.js';

import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/** A captured CodeRabbit review body and the verdict that the shipped phrases must produce for it. */
interface ReviewCorpusEntry {
  readonly file: string;
  /** The review that the body comes from, so a reader can check the capture. */
  readonly sourceReviewUrl: string;
  readonly author: string;
  readonly submittedAt: string;
  readonly expected: {
    readonly matchedPhrase: string;
    readonly matchedOffset: number;
    /** True when the body also holds a configured approval phrase. */
    readonly isApproval: boolean;
  };
}

const FIXTURES_ROOT = join(process.cwd(), 'tests', 'fixtures', 'coderabbit-review-bodies');
const CORPUS = JSON.parse(readFileSync(join(FIXTURES_ROOT, 'manifest.json'), 'utf8')) as readonly ReviewCorpusEntry[];

/**
 * Prove the shipped verdict phrase defaults against real review bodies. CodeRabbit submits a
 * review whose body starts with an "Actionable comments posted" summary. The reviews API returns
 * that summary as the review body, and the comment classifier never sees it as an issue comment.
 */
describe('CodeRabbit review body corpus', () => {
  const markers = createCoderabbitMarkers();

  for (const entry of CORPUS) {
    describe(entry.file, () => {
      const body = readFileSync(join(FIXTURES_ROOT, entry.file), 'utf8');
      const review = SubmittedReview.create({
        userLogin: entry.author,
        body,
        submittedAt: entry.submittedAt,
        commitId: undefined,
      });
      const submittedAt = new Date(entry.submittedAt);
      const sinceBeforeCapture = new Date(submittedAt);
      sinceBeforeCapture.setUTCFullYear(submittedAt.getUTCFullYear() - 1);
      const sinceAfterCapture = new Date(submittedAt);
      sinceAfterCapture.setUTCFullYear(submittedAt.getUTCFullYear() + 1);

      it('finds the verdict phrase where the captured body holds it', () => {
        expect(findPhrase(body, markers.completion)).toStrictEqual({ phrase: entry.expected.matchedPhrase, offset: entry.expected.matchedOffset });
      });

      it('separates a changes-suggested verdict from an approval', () => {
        expect(isApprovalReviewSignal(body, markers.approval)).toBe(entry.expected.isApproval);
      });

      it('accepts the captured review when it lands after the boundary', () => {
        expect(isMatchingCompletedReview(review, sinceBeforeCapture, markers.completion)).toBe(true);
      });

      it('rejects the captured review when it lands before the boundary', () => {
        expect(isMatchingCompletedReview(review, sinceAfterCapture, markers.completion)).toBe(false);
      });
    });
  }
});
