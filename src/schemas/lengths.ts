/**
 * Maximum string lengths for everything we store, in one place.
 *
 * Column limits are enforced by raw-SQL `CHECK (length(col) <= N)` constraints
 * in prisma/migrations/20260618141930_init/migration.sql, because SQLite has no
 * `varchar(n)`. Those literals must be kept in sync with the constants here by
 * hand. Payload-field limits are enforced by the Zod schemas in events.ts.
 */

// Column limits (mirrored in the init migration's CHECK constraints).
export const UUID_MAX_LENGTH = 36;
export const STATUS_MAX_LENGTH = 25;
export const EVENT_TYPE_MAX_LENGTH = 25;
export const CORRELATION_ID_MAX_LENGTH = 73;
export const REQUEST_ID_MAX_LENGTH = 73;
export const VERSION_MAX_LENGTH = 32;
export const PAYLOAD_MAX_LENGTH = 16384;
export const METADATA_MAX_LENGTH = 2048;

// 140 = GitHub owner/org (<=39) + "/" + repo name (<=100). Sources:
//   username/org cap (official): https://docs.github.com/en/enterprise-cloud@latest/admin/managing-iam/iam-configuration-reference/username-considerations-for-external-authentication
//   repo-name cap (community-maintained): https://github.com/dead-claudia/github-limits
export const REPO_FULL_NAME_MAX_LENGTH = 140;

// Payload-field limits (enforced by Zod in events.ts).
export const COMMENT_URL_MAX_LENGTH = 512;
export const REASON_MAX_LENGTH = 1024;

// Column limit for source_comment_url on review_queue.
export const SOURCE_COMMENT_URL_MAX_LENGTH = COMMENT_URL_MAX_LENGTH;
