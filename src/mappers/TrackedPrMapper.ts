import type { TrackedPrResponse, TrackedPrRow } from '../types/index.js';
import { nullableDateToISOString } from '../utils/index.js';

import { injectable } from 'inversify';

@injectable()
export class TrackedPrMapper {
  mapToResponse(row: TrackedPrRow): TrackedPrResponse {
    return {
      repo_full_name: row.repo_full_name,
      pr_number: row.pr_number,
      title: row.title,
      author_login: row.author_login,
      last_review_state: row.last_review_state,
      last_coderabbit_review_at: nullableDateToISOString(row.last_coderabbit_review_at),
    };
  }
}
