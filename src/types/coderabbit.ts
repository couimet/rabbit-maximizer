/** Hidden HTML marker prefix our tool embeds in its comments so detection skips them. */
export const REVIEW_BOT_SELF_MARKER_PREFIX = "<!-- rabbit-optimizer";

/** Hidden HTML marker that identifies a rate-limit comment. */
export const REVIEW_BOT_RATE_LIMIT_MARKER = "rate limited by coderabbit.ai";

/** Command posted to re-trigger a full review. */
export const REVIEW_BOT_RETRIGGER_COMMAND = "@coderabbitai full review";
