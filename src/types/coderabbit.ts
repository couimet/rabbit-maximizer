/**
 * Unclosed HTML comment prefix embedded in our retrigger comments so `hasOwnRetriggerMarker()`
 * can identify them via `includes()`. Intentionally left open (no trailing `-->`) so the
 * prefix matches any variant — with or without extra attributes appended before the closing
 * delimiter. Callers that build a full comment body are responsible for closing it with ` -->`.
 */
export const REVIEW_BOT_SELF_MARKER_PREFIX = '<!-- rabbit-maximizer';

/** Hidden HTML marker that identifies a CodeRabbit rate-limit comment. Used by hasRateLimitMarker() for precise verification against the full comment body (which includes HTML comments via the REST API). */
export const REVIEW_BOT_RATE_LIMIT_MARKER = 'rate limited by coderabbit.ai';

/** Visible text variants from CodeRabbit rate-limit comments used as search query keys. HTML comments are not indexed by GitHub search, so we match against the plain-text assertion in the comment body. The leading "you've" is dropped because the apostrophe breaks GitHub's exact-phrase search parser when wrapped in double quotes. Stored as an array so both past and current CodeRabbit wordings are covered. */
export const REVIEW_BOT_RATE_LIMIT_SEARCH_TEXTS: readonly string[] = ['reached your PR review rate limit', 'reached your PR review limit'];

/** GitHub login of the CodeRabbit bot. */
export const REVIEW_BOT_LOGIN = 'coderabbitai[bot]';

/** Command posted to re-trigger a full CodeRabbit review. */
export const REVIEW_BOT_RETRIGGER_COMMAND = '@coderabbitai full review';

/** Body text markers that identify a completed CodeRabbit review via the PR reviews API. Each entry is a substring match against the review body. */
export const REVIEW_BOT_COMPLETION_SIGNALS: readonly string[] = ['Actionable comments posted:', 'No actionable comments were generated in the recent review.'];

/** HTML comment that CodeRabbit includes in auto-generated reply comments. */
export const REVIEW_BOT_ACKNOWLEDGEMENT_MARKER = '<!-- This is an auto-generated reply by CodeRabbit -->';
