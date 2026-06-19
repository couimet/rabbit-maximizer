import { describe, it, expect } from "@jest/globals";
import { extractRepoFullName } from "../../src/github/extractRepoFullName.js";
import { makeUniqueRepoName } from "../helpers/index.js";

describe("extractRepoFullName", () => {
  it("strips the GitHub API repository prefix", () => {
    const { fullName } = makeUniqueRepoName();
    expect(
      extractRepoFullName(`https://api.github.com/repos/${fullName}`),
    ).toBe(fullName);
  });

  it("throws a RabbitOptimizerError when the URL lacks the expected prefix", () => {
    const { fullName } = makeUniqueRepoName();
    const badUrl = `https://example.com/repos/${fullName}`;
    expect(() => extractRepoFullName(badUrl)).toThrowRabbitOptimizerError(
      "GITHUB_API_ERROR",
      {
        message: "Invalid repository URL format",
        functionName: "extractRepoFullName",
        details: { repositoryUrl: badUrl },
      },
    );
  });
});
