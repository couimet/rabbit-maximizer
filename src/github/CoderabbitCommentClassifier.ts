import { CodeRabbitCommentType, MatchedMarker } from '../domain.js';
import { TYPES } from '../server-domain.js';
import type { CommentClassification } from '../types/index.js';

import { hasRateLimitMarker, isApprovalReviewSignal, isCompletedReview, REVIEW_BOT_SKIP_MARKER } from './index.js';
import type { RefusalPhrases } from './RefusalPhrases.js';

import { inject, injectable } from 'inversify';

/**
 * A permanent refusal outranks every other signal, because CodeRabbit's refusal comment
 * also carries the skip marker. No retrigger clears a refusal, so a refused comment must
 * never classify as review_skipped.
 */
@injectable()
export class CoderabbitCommentClassifier {
  /* c8 ignore start — decorator emit branches */
  constructor(
    @inject(TYPES.RefusalPhrases)
    private readonly refusalPhrases: RefusalPhrases,
  ) {}
  /* c8 ignore stop */

  classify(body: string): CommentClassification {
    const matchedPhrase = this.refusalPhrases.match(body);
    if (matchedPhrase !== undefined) {
      return { classification: CodeRabbitCommentType.review_refused, matchedMarker: undefined, matchedPhrase };
    }
    if (body.includes(REVIEW_BOT_SKIP_MARKER)) {
      return { classification: CodeRabbitCommentType.review_skipped, matchedMarker: MatchedMarker.skip, matchedPhrase: undefined };
    }
    if (isCompletedReview(body)) {
      return isApprovalReviewSignal(body)
        ? { classification: CodeRabbitCommentType.review_approved, matchedMarker: MatchedMarker.approval, matchedPhrase: undefined }
        : {
            classification: CodeRabbitCommentType.review_changes_suggested,
            matchedMarker: MatchedMarker.changes_suggested,
            matchedPhrase: undefined,
          };
    }
    if (hasRateLimitMarker(body)) {
      return { classification: CodeRabbitCommentType.review_limited, matchedMarker: MatchedMarker.rate_limit, matchedPhrase: undefined };
    }
    return { classification: CodeRabbitCommentType.unknown, matchedMarker: undefined, matchedPhrase: undefined };
  }
}
