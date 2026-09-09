import type { EventEntryResponse } from '../../../src/types/index.js';

export interface EventFilterOptions {
  readonly repos: readonly string[];
  readonly prs: readonly string[];
}

export interface FilterContradiction {
  readonly prLabel: string;
}

export const deriveEventFilterOptions = (items: readonly EventEntryResponse[]): EventFilterOptions => {
  const repos = [...new Set(items.map((event) => event.repo_full_name))].sort(compareRepoNames);
  const uniquePrEvents = [...new Map(items.map((event) => [prLabelOf(event), event])).values()];
  uniquePrEvents.sort((a, b) => compareRepoNames(a.repo_full_name, b.repo_full_name) || a.pr_number - b.pr_number);
  return { repos, prs: uniquePrEvents.map(prLabelOf) };
};

export const eventMatchesFilter = (event: EventEntryResponse, selectedRepos: ReadonlySet<string>, selectedPrs: ReadonlySet<string>): boolean => {
  const repoMatches = selectedRepos.size === 0 || selectedRepos.has(event.repo_full_name);
  const prMatches = selectedPrs.size === 0 || selectedPrs.has(prLabelOf(event));
  return repoMatches && prMatches;
};

export const findFilterContradiction = (selectedRepos: ReadonlySet<string>, selectedPrs: ReadonlySet<string>): FilterContradiction | null => {
  if (selectedRepos.size === 0 || selectedPrs.size === 0) {
    return null;
  }
  const prLabels = [...selectedPrs];
  if (prLabels.some((label) => selectedRepos.has(repoOf(label)))) {
    return null;
  }
  return { prLabel: prLabels[0] };
};

const prLabelOf = (event: EventEntryResponse): string => `${event.repo_full_name}#${event.pr_number}`;
const repoOf = (prLabel: string): string => prLabel.slice(0, prLabel.lastIndexOf('#'));
const compareRepoNames = (a: string, b: string): number => a.localeCompare(b);
