import { TrackedPrMapper } from '../../src/mappers/index.js';
import { IgnoreRules } from '../../src/services.js';
import { generateConfigData, generateTrackedPrRow } from '../helpers/index.js';

import { getUniqueDate, getUniqueString } from '@couimet/dynamic-testing';
import { describe, expect, it } from '@jest/globals';

const buildMapper = (ignoreAuthors: readonly string[], ignoreTitles: readonly string[]): TrackedPrMapper =>
  new TrackedPrMapper(new IgnoreRules(generateConfigData({ IGNORE_AUTHORS: [...ignoreAuthors], IGNORE_TITLES: [...ignoreTitles] })));

describe('TrackedPrMapper', () => {
  it('maps a row with no matching rule and no review timestamp', () => {
    const row = generateTrackedPrRow({ last_review_state: null, last_coderabbit_review_at: null });

    const result = buildMapper([], []).mapToResponse(row);

    expect(result).toStrictEqual({
      repo_full_name: row.repo_full_name,
      pr_number: row.pr_number,
      title: row.title,
      author_login: row.author_login,
      matched_ignore_rule: null,
      last_review_state: null,
      last_coderabbit_review_at: null,
    });
  });

  it('maps a row with a review timestamp', () => {
    const reviewAt = getUniqueDate();
    const row = generateTrackedPrRow({ last_review_state: 'review_approved', last_coderabbit_review_at: reviewAt });

    const result = buildMapper([], []).mapToResponse(row);

    expect(result).toStrictEqual({
      repo_full_name: row.repo_full_name,
      pr_number: row.pr_number,
      title: row.title,
      author_login: row.author_login,
      matched_ignore_rule: null,
      last_review_state: 'review_approved',
      last_coderabbit_review_at: reviewAt.toISOString(),
    });
  });

  it('names the author rule that matches the row', () => {
    const row = generateTrackedPrRow({ author_login: 'renovate-bot', title: getUniqueString() });

    const result = buildMapper(['renovate'], []).mapToResponse(row);

    expect(result.matched_ignore_rule).toStrictEqual({ field: 'author', pattern: 'renovate' });
  });

  it('names the title rule that matches the row', () => {
    const row = generateTrackedPrRow({ author_login: getUniqueString(), title: 'chore(deps): bump lodash' });

    const result = buildMapper([], ['^chore\\(']).mapToResponse(row);

    expect(result.matched_ignore_rule).toStrictEqual({ field: 'title', pattern: '^chore\\(' });
  });

  it('reports no match for a row that matches nothing', () => {
    const row = generateTrackedPrRow({ author_login: getUniqueString(), title: getUniqueString() });

    const result = buildMapper(['renovate'], ['^chore\\(']).mapToResponse(row);

    expect(result.matched_ignore_rule).toBeNull();
  });
});
