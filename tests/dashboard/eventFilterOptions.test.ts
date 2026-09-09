import { deriveEventFilterOptions, eventMatchesFilter, findFilterContradiction } from '../../dashboard/src/components/eventFilterOptions.js';
import type { EventEntryResponse } from '../../src/types/index.js';

import { getUniqueDate, getUniqueGitHubRepoRef, getUniqueInt, getUuid } from '@couimet/dynamic-testing';
import { describe, expect, it } from '@jest/globals';

const REPO_FIRST = 'alpha/repo';
const REPO_SECOND = 'beta/repo';

/** @testFixture */
const makeEvent = (over: Record<string, unknown> = {}): EventEntryResponse => ({
  id: getUniqueInt(),
  uuid: getUuid(),
  ts: getUniqueDate().toISOString(),
  type: 'detected',
  repo_full_name: getUniqueGitHubRepoRef().fullName,
  pr_number: getUniqueInt(),
  correlation_id: getUuid(),
  version: '1.0.0',
  payload: {},
  ...over,
});

describe('deriveEventFilterOptions', () => {
  it('returns empty options for no events', () => {
    expect(deriveEventFilterOptions([])).toStrictEqual({ repos: [], prs: [] });
  });

  it('returns one repo and one PR for a single event', () => {
    const event = makeEvent({ repo_full_name: REPO_FIRST, pr_number: 5 });
    expect(deriveEventFilterOptions([event])).toStrictEqual({
      repos: [REPO_FIRST],
      prs: [`${REPO_FIRST}#5`],
    });
  });

  it('lists unique repos in alphabetical order', () => {
    const options = deriveEventFilterOptions([
      makeEvent({ repo_full_name: REPO_SECOND, pr_number: 5 }),
      makeEvent({ repo_full_name: REPO_FIRST, pr_number: 7 }),
      makeEvent({ repo_full_name: REPO_FIRST, pr_number: 3 }),
      makeEvent({ repo_full_name: REPO_SECOND, pr_number: 5 }),
    ]);
    expect(options.repos).toStrictEqual([REPO_FIRST, REPO_SECOND]);
  });

  it('orders PRs by repo then numeric PR and drops duplicate repo#pr rows', () => {
    const options = deriveEventFilterOptions([
      makeEvent({ repo_full_name: REPO_SECOND, pr_number: 2 }),
      makeEvent({ repo_full_name: REPO_FIRST, pr_number: 111 }),
      makeEvent({ repo_full_name: REPO_FIRST, pr_number: 9 }),
      makeEvent({ repo_full_name: REPO_FIRST, pr_number: 9 }),
    ]);
    expect(options.prs).toStrictEqual([`${REPO_FIRST}#9`, `${REPO_FIRST}#111`, `${REPO_SECOND}#2`]);
  });
});

describe('eventMatchesFilter', () => {
  const event = makeEvent({ repo_full_name: REPO_FIRST, pr_number: 5 });

  it('matches everything when both axes are empty', () => {
    expect(eventMatchesFilter(event, new Set(), new Set())).toBe(true);
  });

  it('matches by repo alone when the PR axis is empty', () => {
    expect(eventMatchesFilter(event, new Set([REPO_FIRST]), new Set())).toBe(true);
    expect(eventMatchesFilter(event, new Set([REPO_SECOND]), new Set())).toBe(false);
  });

  it('matches by PR alone when the repo axis is empty', () => {
    expect(eventMatchesFilter(event, new Set(), new Set([`${REPO_FIRST}#5`]))).toBe(true);
    expect(eventMatchesFilter(event, new Set(), new Set([`${REPO_FIRST}#6`]))).toBe(false);
  });

  it('ANDs a repo outside the repo axis with a matching PR to nothing', () => {
    expect(eventMatchesFilter(event, new Set([REPO_SECOND]), new Set([`${REPO_FIRST}#5`]))).toBe(false);
  });

  it('matches when the event satisfies both axes', () => {
    expect(eventMatchesFilter(event, new Set([REPO_FIRST]), new Set([`${REPO_FIRST}#5`]))).toBe(true);
  });
});

describe('findFilterContradiction', () => {
  it('returns null when either axis is empty', () => {
    expect(findFilterContradiction(new Set(), new Set([`${REPO_FIRST}#5`]))).toBeNull();
    expect(findFilterContradiction(new Set([REPO_FIRST]), new Set())).toBeNull();
  });

  it('returns null when at least one selected PR repo is in the repo axis', () => {
    const contradiction = findFilterContradiction(new Set([REPO_FIRST]), new Set([`${REPO_FIRST}#5`, `${REPO_SECOND}#2`]));
    expect(contradiction).toBeNull();
  });

  it('names a selected PR when every selected PR repo is outside the repo axis', () => {
    const contradiction = findFilterContradiction(new Set([REPO_SECOND]), new Set([`${REPO_FIRST}#5`]));
    expect(contradiction).toStrictEqual({ prLabel: `${REPO_FIRST}#5` });
  });
});
