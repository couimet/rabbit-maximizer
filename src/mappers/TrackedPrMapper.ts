import type { IgnoreRules } from '../IgnoreRules.js';
import { TYPES } from '../server-domain.js';
import type { TrackedPrResponse, TrackedPrRow } from '../types/index.js';
import { nullableDateToISOString } from '../utils/index.js';

import { inject, injectable } from 'inversify';

@injectable()
export class TrackedPrMapper {
  /* c8 ignore start — decorator emit branches */
  constructor(@inject(TYPES.IgnoreRules) private readonly ignoreRules: IgnoreRules) {}
  /* c8 ignore stop */

  mapToResponse(row: TrackedPrRow): TrackedPrResponse {
    const match = this.ignoreRules.match({ authorLogin: row.author_login, title: row.title });
    return {
      repo_full_name: row.repo_full_name,
      pr_number: row.pr_number,
      title: row.title,
      author_login: row.author_login,
      matched_ignore_rule: match === undefined ? null : { field: match.field, pattern: match.pattern },
      last_review_state: row.last_review_state,
      last_coderabbit_review_at: nullableDateToISOString(row.last_coderabbit_review_at),
    };
  }
}
