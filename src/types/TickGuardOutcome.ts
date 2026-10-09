import type { TickGuardReason } from '../TickGuardReason.js';

export type TickGuardOutcome =
  { readonly allowed: true } | { readonly allowed: false; readonly reason: TickGuardReason; readonly retryAfterMs: number | undefined };
