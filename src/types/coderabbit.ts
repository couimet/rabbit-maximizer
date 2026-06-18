/** Hidden HTML marker prefix our tool embeds in its comments so detection skips them. */
export const CODERABBIT_SELF_MARKER_PREFIX = "<!-- rabbit-optimizer";

/** Hidden HTML marker that identifies a CodeRabbit rate-limit comment. */
export const CODERABBIT_RATE_LIMIT_MARKER = "rate limited by coderabbit.ai";

/** Command posted to re-trigger a full CodeRabbit review. */
export const CODERABBIT_RETRIGGER_COMMAND = "@coderabbitai full review";
