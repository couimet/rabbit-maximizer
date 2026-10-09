/**
 * Rate-limit details that {@link parseGitHubRateLimitError} reads from the
 * `x-ratelimit-*` headers of a 403 or 429 response.
 *
 * `resetEpoch`, `status`, and `remaining` are present on every result, because
 * the parser requires a parseable reset header and a zero remaining header
 * (`remaining` is always `0`).
 * GitHub sends the other quota headers for a primary limit only, so `limit`,
 * `used`, and `resource` stay optional. A secondary (abuse) limit response, a
 * proxy 429, or an older GitHub Enterprise Server can omit them.
 */
export interface RateLimitInfo {
  readonly resetEpoch: number;
  readonly status: number;
  readonly limit: number | undefined;
  readonly remaining: number | undefined;
  readonly used: number | undefined;
  readonly resource: string | undefined;
}
