import { buildSearchQuery } from '../../src/github/index.js';
import type { RepoFilter } from '../../src/types/RepoFilter.js';

import { describe, expect, it } from '@jest/globals';

describe('buildSearchQuery', () => {
  const userFilter: RepoFilter = { pattern: 'couimet/*', scope: 'user' };
  const repoFilter: RepoFilter = {
    pattern: 'other-org/specific-repo',
    scope: 'repo',
  };

  it('wraps multiple qualifiers in an OR group', () => {
    const query = buildSearchQuery([userFilter, repoFilter]);
    expect(query).toBe('("review limit" OR "rate limit") type:pr state:open (user:couimet OR repo:other-org/specific-repo)');
  });

  it('uses a bare qualifier for a single filter', () => {
    const query = buildSearchQuery([userFilter]);
    expect(query).toBe('("review limit" OR "rate limit") type:pr state:open user:couimet');
  });

  it('omits the qualifier clause when the filter list is empty', () => {
    const query = buildSearchQuery([]);
    expect(query).toBe('("review limit" OR "rate limit") type:pr state:open');
  });
});
