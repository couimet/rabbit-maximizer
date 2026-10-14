/**
 * Rate-limit details that {@link parseGitHubRateLimitError} reads from a 403 or
 * 429 response.
 *
 * `kind` names where the wait comes from. GitHub reports an exhausted primary
 * quota with the `x-ratelimit-*` headers, and it reports a secondary (abuse)
 * limit with a `retry-after` header or a message that names the limit.
 *
 * `status`, `remaining`, and the quota headers stay shared. GitHub sends
 * `limit`, `used`, and `resource` for a primary limit only, so those stay
 * optional, and a secondary-limit response can omit the quota headers entirely.
 */
interface RateLimitInfoBase {
  readonly status: number;
  readonly limit: number | undefined;
  readonly remaining: number | undefined;
  readonly used: number | undefined;
  readonly resource: string | undefined;
}

export type RateLimitInfo =
  | (RateLimitInfoBase & { readonly kind: 'quota-exhausted'; readonly resetEpoch: number })
  | (RateLimitInfoBase & { readonly kind: 'throttled'; readonly retryAfterSec: number | undefined });
