import { getUniqueString } from "@couimet/dynamic-testing";

export const makeUniqueRepoName = () => {
  const owner = getUniqueString({ charset: "alpha", prefix: "owner-" });
  const repo = getUniqueString({ charset: "alpha", prefix: "repo-" });
  return { owner, repo, fullName: `${owner}/${repo}` } as const;
};
