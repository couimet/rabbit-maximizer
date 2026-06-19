import { describe, it, expect } from "@jest/globals";
import { splitRepo } from "../../src/github/splitRepo.js";
import { makeUniqueRepoName } from "../helpers/index.js";

describe("splitRepo", () => {
  it("splits an owner/repo string into its two parts", () => {
    const { owner, repo, fullName } = makeUniqueRepoName();
    expect(splitRepo(fullName)).toStrictEqual({ owner, repo });
  });

  it("throws a RabbitOptimizerError when the input lacks a slash", () => {
    const { owner } = makeUniqueRepoName();
    expect(() => splitRepo(owner)).toThrowRabbitOptimizerError(
      "GITHUB_API_ERROR",
      {
        message: "Invalid repo fullName format",
        functionName: "splitRepo",
        details: { fullName: owner },
      },
    );
  });

  it("throws a RabbitOptimizerError when the input is empty", () => {
    expect(() => splitRepo("")).toThrowRabbitOptimizerError(
      "GITHUB_API_ERROR",
      {
        message: "Invalid repo fullName format",
        functionName: "splitRepo",
        details: { fullName: "" },
      },
    );
  });

  it("throws a RabbitOptimizerError when the repo part is missing", () => {
    const { owner } = makeUniqueRepoName();
    expect(() => splitRepo(`${owner}/`)).toThrowRabbitOptimizerError(
      "GITHUB_API_ERROR",
      {
        message: "Invalid repo fullName format",
        functionName: "splitRepo",
        details: { fullName: `${owner}/` },
      },
    );
  });
});
