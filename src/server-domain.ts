/**
 * Barrel for domain symbols at the src/ root that the browser must not reach.
 * `IntervalService` imports `@couimet/execution-context`, which pulls the
 * OpenTelemetry async-hooks chain, and `TYPES` is the DI symbol map. Neither
 * belongs in a client bundle, so both stay out of the browser-safe `domain.ts`
 * that the dashboard imports.
 */
export { IntervalService } from './IntervalService.js';
export { TYPES } from './inversify-types.js';
