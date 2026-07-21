import { buildOpenPRSearchQuery } from '../../src/github/index.js';
import type { RepoFilter } from '../../src/types/RepoFilter.js';

import { describe, expect, it } from '@jest/globals';

describe('buildOpenPRSearchQuery', () => {
  const USER_FILTER: RepoFilter = { pattern: 'couimet/*', scope: 'user' };
  const REPO_FILTER: RepoFilter = { pattern: 'other-org/specific-repo', scope: 'repo' };

  it('wraps multiple qualifiers in an OR group', () => {
    const query = buildOpenPRSearchQuery([USER_FILTER, REPO_FILTER]);
    expect(query).toBe('is:pr state:open (user:couimet OR repo:other-org/specific-repo)');
  });

  it('uses a bare qualifier for a single filter', () => {
    const query = buildOpenPRSearchQuery([USER_FILTER]);
    expect(query).toBe('is:pr state:open user:couimet');
  });

  it('omits the qualifier clause when the filter list is empty', () => {
    const query = buildOpenPRSearchQuery([]);
    expect(query).toBe('is:pr state:open');
  });
});
