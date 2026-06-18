/** Hidden HTML marker prefix our tool embeds in its comments so detection skips them. */
export const CODERABBIT_SELF_MARKER_PREFIX = "<!-- rabbit-optimizer";

/** Hidden HTML marker that identifies a CodeRabbit rate-limit comment. Used by hasRateLimitMarker() for precise verification against the full comment body (which includes HTML comments via the REST API). */
export const CODERABBIT_RATE_LIMIT_MARKER = "rate limited by coderabbit.ai";

/** Visible text from CodeRabbit rate-limit comments used as the search query key. HTML comments are not indexed by GitHub search, so we match against the plain-text assertion in the comment body. The leading "you've" is dropped because the apostrophe breaks GitHub's exact-phrase search parser when wrapped in double quotes. */
export const CODERABBIT_RATE_LIMIT_SEARCH_TEXT =
  "reached your PR review rate limit";

/** Command posted to re-trigger a full CodeRabbit review. */
export const CODERABBIT_RETRIGGER_COMMAND = "@coderabbitai full review";
