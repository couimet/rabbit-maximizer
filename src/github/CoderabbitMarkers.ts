import type { Config } from '../config.js';
import { TYPES } from '../server-domain.js';

import { inject, injectable } from 'inversify';

/**
 * The configured comment-body phrases, grouped by the CodeRabbit signal that each one marks.
 * A consumer injects this class instead of `Config`, so the operator changes a phrase in one
 * place and every consumer reads the new value (rule C017).
 */
@injectable()
export class CoderabbitMarkers {
  /** Phrases that mark the bot's reply to a retrigger. */
  readonly acknowledgement: readonly string[];
  /** Phrases that mark a review with no actionable comments. */
  readonly approval: readonly string[];
  /** Phrases that mark a review with actionable comments. */
  readonly changesSuggested: readonly string[];
  /** Both verdict phrase lists, because a completed review carries one of the two. */
  readonly completion: readonly string[];
  /** Phrases that mark a comment on a review that CodeRabbit paused. */
  readonly pause: readonly string[];
  /** Phrases that mark a rate-limit comment. */
  readonly rateLimit: readonly string[];
  /** Both lists, because a rate-limit comment sometimes carries the skip marker instead. */
  readonly rateLimitOrSkip: readonly string[];
  /** Phrases that mark a permanent refusal. */
  readonly refusal: readonly string[];
  /** Phrases that mark a skipped review. */
  readonly skip: readonly string[];
  /** Phrases that mark a walkthrough comment. */
  readonly walkthrough: readonly string[];

  /* c8 ignore start — decorator emit branches */
  constructor(@inject(TYPES.Config) cfg: Config) {
    this.acknowledgement = cfg.CODERABBIT_ACKNOWLEDGEMENT_PHRASES;
    this.approval = cfg.CODERABBIT_APPROVAL_PHRASES;
    this.changesSuggested = cfg.CODERABBIT_CHANGES_SUGGESTED_PHRASES;
    this.completion = [...cfg.CODERABBIT_CHANGES_SUGGESTED_PHRASES, ...cfg.CODERABBIT_APPROVAL_PHRASES];
    this.pause = cfg.CODERABBIT_PAUSE_PHRASES;
    this.rateLimit = cfg.CODERABBIT_RATE_LIMIT_PHRASES;
    this.rateLimitOrSkip = [...cfg.CODERABBIT_RATE_LIMIT_PHRASES, ...cfg.CODERABBIT_SKIP_PHRASES];
    this.refusal = cfg.CODERABBIT_REFUSAL_PHRASES;
    this.skip = cfg.CODERABBIT_SKIP_PHRASES;
    this.walkthrough = cfg.CODERABBIT_WALKTHROUGH_PHRASES;
  }
  /* c8 ignore stop */
}
