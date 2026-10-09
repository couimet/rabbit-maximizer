/**
 * Barrel for utils whose module graph reaches a Node builtin, so the browser
 * must never evaluate them. Vite evaluates every module a shared barrel
 * re-exports, and the externalized stub throws on the first property read.
 *
 * The reason is not always a direct import. getRunIdAttribute reads the
 * execution context, which pulls the OpenTelemetry async-hooks chain, so it
 * reaches `async_hooks` without naming a builtin itself.
 */
export { getRunIdAttribute } from './getRunIdAttribute.js';
export { hasBuiltDashboard } from './hasBuiltDashboard.js';
export { readRunIdentity } from './readRunIdentity.js';
