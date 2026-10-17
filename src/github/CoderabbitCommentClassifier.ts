import { CodeRabbitCommentType } from '../domain.js';
import { TYPES } from '../server-domain.js';
import type { CommentClassification } from '../types/index.js';
import { findPhrase } from '../utils/index.js';

import type { CoderabbitMarkers } from './CoderabbitMarkers.js';

import { inject, injectable } from 'inversify';

/**
 * Classify a comment body by the configured phrases it holds.
 *
 * The order below fixes the precedence when a body holds several phrases. A refusal
 * outranks every other signal, because CodeRabbit's refusal comment also carries the
 * skip marker, and no retrigger clears a refusal.
 */
@injectable()
export class CoderabbitCommentClassifier {
  /* c8 ignore start — decorator emit branches */
  constructor(
    @inject(TYPES.CoderabbitMarkers)
    private readonly markers: CoderabbitMarkers,
  ) {}
  /* c8 ignore stop */

  classify(body: string): CommentClassification {
    const refusal = findPhrase(body, this.markers.refusal);
    if (refusal !== undefined) {
      return { classification: CodeRabbitCommentType.review_refused, matchedPhrase: refusal.phrase, matchedOffset: refusal.offset };
    }

    const skip = findPhrase(body, this.markers.skip);
    if (skip !== undefined) {
      return { classification: CodeRabbitCommentType.review_skipped, matchedPhrase: skip.phrase, matchedOffset: skip.offset };
    }

    const completion = findPhrase(body, this.markers.completion);
    if (completion !== undefined) {
      const approval = findPhrase(body, this.markers.approval);
      return approval !== undefined
        ? { classification: CodeRabbitCommentType.review_approved, matchedPhrase: approval.phrase, matchedOffset: approval.offset }
        : {
            classification: CodeRabbitCommentType.review_changes_suggested,
            matchedPhrase: completion.phrase,
            matchedOffset: completion.offset,
          };
    }

    const pause = findPhrase(body, this.markers.pause);
    if (pause !== undefined) {
      return { classification: CodeRabbitCommentType.review_skipped, matchedPhrase: pause.phrase, matchedOffset: pause.offset };
    }

    const rateLimit = findPhrase(body, this.markers.rateLimit);
    if (rateLimit !== undefined) {
      return { classification: CodeRabbitCommentType.review_limited, matchedPhrase: rateLimit.phrase, matchedOffset: rateLimit.offset };
    }

    return { classification: CodeRabbitCommentType.unknown, matchedPhrase: undefined, matchedOffset: undefined };
  }
}
