/**
 * Unclosed HTML comment prefix embedded in our retrigger comments so `hasOwnRetriggerMarker()`
 * can identify them via `includes()`. Intentionally left open (no trailing `-->`) so the
 * prefix matches any variant — with or without extra attributes appended before the closing
 * delimiter. Callers that build a full comment body are responsible for closing it with ` -->`.
 */
export const REVIEW_BOT_SELF_MARKER_PREFIX = '<!-- rabbit-maximizer';

/** Hidden HTML marker that identifies a CodeRabbit rate-limit comment. Used by hasRateLimitMarker() for precise verification against the full comment body (which includes HTML comments via the REST API). */
export const REVIEW_BOT_RATE_LIMIT_MARKER = 'rate limited by coderabbit.ai';

/** Two-word search phrases that survive GitHub's exact-phrase matching with `state:open`. Longer phrases containing "reached" (e.g. "reached your PR review limit") return zero results when combined with `state:open` on the Search API. Short two-word phrases avoid the tokenization gap. Both variants are kept to cover past and current CodeRabbit wordings. */
export const REVIEW_BOT_RATE_LIMIT_SEARCH_TEXTS: readonly string[] = ['review limit', 'rate limit'];

/** GitHub login of the CodeRabbit bot. */
export const REVIEW_BOT_LOGIN = 'coderabbitai[bot]';

/** Command posted to re-trigger a full CodeRabbit review. */
export const REVIEW_BOT_RETRIGGER_COMMAND = '@coderabbitai full review';

/** Hidden HTML marker that identifies a CodeRabbit review with actionable comments (changes suggested). */
export const REVIEW_BOT_ACTIONABLE_SIGNAL = 'Actionable comments posted:';

/** Hidden HTML marker that identifies a CodeRabbit review with no actionable comments (approval). */
export const REVIEW_BOT_NO_ACTIONABLE_SIGNAL = 'No actionable comments were generated in the recent review.';

/** Hidden HTML marker that identifies a CodeRabbit review stack entry start (review completion). Catches combined review+rate-limit comments where a walkthrough was generated but the standard completion signals are absent. */
export const REVIEW_STACK_MARKER = 'review_stack_entry_start';

/** Body text markers that identify a completed CodeRabbit review. Each entry is a substring match against the comment body. */
export const REVIEW_BOT_COMPLETION_SIGNALS: readonly string[] = [REVIEW_BOT_ACTIONABLE_SIGNAL, REVIEW_BOT_NO_ACTIONABLE_SIGNAL, REVIEW_STACK_MARKER];

/** Hidden HTML marker that identifies a CodeRabbit acknowledgement reply (the bot's "I'll review this" response to a retrigger). */
export const REVIEW_BOT_ACKNOWLEDGEMENT_MARKER = 'auto-generated reply by CodeRabbit';

/** Hidden HTML marker that identifies a CodeRabbit review-skipped comment. */
export const REVIEW_BOT_SKIP_MARKER = 'skip review by coderabbit.ai';
