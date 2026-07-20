import type { RepoFilter } from '../types/RepoFilter.js';

/**
 * Build the repo qualifier portion of a GitHub search query from repo filter entries.
 *
 * Scopes:
 *   user — `user:<owner>` qualifier (wildcard patterns like `owner/*`)
 *   repo — `repo:<owner>/<name>` qualifier (explicit repos)
 *
 * Returns undefined when the filter list is empty (no qualifier clause).
 */
export const buildRepoQualifierClause = (repoFilter: readonly RepoFilter[]): string | undefined => {
  const qualifiers = repoFilter.map((f) => {
    if (f.scope === 'user') {
      const owner = f.pattern.split('/')[0];
      return `user:${owner}`;
    }
    return `repo:${f.pattern}`;
  });
  if (qualifiers.length === 0) return undefined;
  if (qualifiers.length === 1) return qualifiers[0];
  return `(${qualifiers.join(' OR ')})`;
};
