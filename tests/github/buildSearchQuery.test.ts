import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import { buildSearchQuery } from "../../src/github/buildSearchQuery.js";
import type { RepoFilter } from "../../src/types/RepoFilter.js";

describe("buildSearchQuery", () => {
  const frozenDate = new Date("2026-06-18T12:00:00Z");

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(frozenDate);
  });

  const userFilter: RepoFilter = { pattern: "couimet/*", scope: "user" };
  const repoFilter: RepoFilter = {
    pattern: "other-org/specific-repo",
    scope: "repo",
  };

  const twentyFourHoursAgo = new Date(
    frozenDate.getTime() - 24 * 60 * 60 * 1000,
  ).toISOString();

  it("wraps multiple qualifiers in an OR group", () => {
    const query = buildSearchQuery([userFilter, repoFilter]);
    expect(query).toBe(
      `"reached your PR review rate limit" type:pr state:open (user:couimet OR repo:other-org/specific-repo) created:>=${twentyFourHoursAgo}`,
    );
  });

  it("uses a bare qualifier for a single filter", () => {
    const query = buildSearchQuery([userFilter]);
    expect(query).toBe(
      `"reached your PR review rate limit" type:pr state:open user:couimet created:>=${twentyFourHoursAgo}`,
    );
  });

  it("omits the qualifier clause when the filter list is empty", () => {
    const query = buildSearchQuery([]);
    expect(query).toBe(
      `"reached your PR review rate limit" type:pr state:open created:>=${twentyFourHoursAgo}`,
    );
  });
});
