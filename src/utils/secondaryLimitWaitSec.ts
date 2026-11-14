/**
 * Wait applied when GitHub throttles a request and the response carries no
 * delay of its own. GitHub documents one minute as the minimum wait after a
 * secondary rate limit, and a secondary-limit response can omit the
 * retry-after header that would name an exact wait.
 */
const SECONDARY_LIMIT_FALLBACK_WAIT_SEC = 60;

/** A negative or non-finite retry-after cannot time a backoff, so it falls back to the documented minimum. */
export const secondaryLimitWaitSec = (retryAfterSec: number | undefined): number =>
  retryAfterSec !== undefined && Number.isFinite(retryAfterSec) && retryAfterSec >= 0 ? retryAfterSec : SECONDARY_LIMIT_FALLBACK_WAIT_SEC;
