import type { IgnoreRuleMatch, IgnoreRuleTarget } from './types/index.js';
import type { Config } from './config.js';
import { IgnoreRuleField } from './domain.js';
import { TYPES } from './server-domain.js';

import { inject, injectable } from 'inversify';

interface CompiledRule {
  readonly field: IgnoreRuleField;
  readonly pattern: string;
  readonly regex: RegExp;
}

/**
 * The operator's exclusion rules for pull requests. Each pattern is an unanchored
 * regular expression, so a rule matches anywhere in the author login or the title.
 * Nothing is written to the pull request row: every detection re-matches the
 * current rules against the current row, so a removed rule or a retitle ends the
 * match with no second write.
 */
@injectable()
export class IgnoreRules {
  private readonly rules: readonly CompiledRule[];

  /* c8 ignore start — decorator emit branches */
  constructor(@inject(TYPES.Config) cfg: Config) {
    this.rules = [
      ...cfg.IGNORE_AUTHORS.map((pattern) => ({ field: IgnoreRuleField.author, pattern, regex: new RegExp(pattern) })),
      ...cfg.IGNORE_TITLES.map((pattern) => ({ field: IgnoreRuleField.title, pattern, regex: new RegExp(pattern) })),
    ];
  }
  /* c8 ignore stop */

  /** True when the operator configured at least one rule. Callers skip the pull request read when the answer is false. */
  hasRules(): boolean {
    return this.rules.length > 0;
  }

  /**
   * The first rule that matches, or undefined when none does. Rules are tested in
   * config order, authors before titles, so a pull request both an author rule and
   * a title rule match reports the author rule.
   */
  match(target: IgnoreRuleTarget): IgnoreRuleMatch | undefined {
    for (const rule of this.rules) {
      const value = rule.field === IgnoreRuleField.author ? target.authorLogin : target.title;
      if (rule.regex.test(value)) {
        return { field: rule.field, pattern: rule.pattern };
      }
    }
    return undefined;
  }
}
