/**
 * The build identity of the running process. Every value reads `unknown` when
 * its source is absent, so a log record always carries the same four keys.
 */
export interface RunIdentity {
  readonly version: string;
  readonly gitSha: string;
  readonly runKind: string;
  readonly imageTags: string;
}
