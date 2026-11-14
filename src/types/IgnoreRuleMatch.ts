import type { IgnoreRuleField } from '../domain.js';

/** The ignore rule that matched a pull request, as the operator wrote the pattern. */
export interface IgnoreRuleMatch {
  readonly field: IgnoreRuleField;
  readonly pattern: string;
}
