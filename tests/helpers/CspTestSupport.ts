/**
 * The `content-security-policy` value helmet produces when the caller drops
 * `upgrade-insecure-requests`. The server drops that one directive so the
 * dashboard assets load over plain HTTP from a LAN address.
 */
export const EXPECTED_CSP_WITHOUT_UPGRADE_INSECURE_REQUESTS =
  "default-src 'self';base-uri 'self';font-src 'self' https: data:;form-action 'self';frame-ancestors 'self';img-src 'self' data:;object-src 'none';script-src 'self';script-src-attr 'none';style-src 'self' https: 'unsafe-inline'";
