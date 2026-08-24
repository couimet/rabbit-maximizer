/**
 * Wire keys of the events table. snake_case is intentional: these are the
 * database column names and the JSON keys `events.record()` writes, while
 * `ExecutionContext` exposes the ids in camelCase.
 * `getEventTraceAttributes()` translates between the two.
 */
export interface EventTraceAttributes {
  readonly correlation_id: string;
  readonly request_id: string;
  readonly version: string;
}
