import { describe, it, expect } from "@jest/globals";
import { extractRepoFullName } from "../../src/github/extractRepoFullName.js";

describe("extractRepoFullName", () => {
  it("strips the GitHub API repository prefix", () => {
    expect(
      extractRepoFullName("https://api.github.com/repos/couimet/my-repo"),
    ).toBe("couimet/my-repo");
  });

  it("throws a RabbitOptimizerError when the URL lacks the expected prefix", () => {
    expect(() =>
      extractRepoFullName("https://example.com/repos/owner/repo"),
    ).toThrowRabbitOptimizerError("GITHUB_API_ERROR", {
      message: "Invalid repository URL format",
      functionName: "extractRepoFullName",
      details: { repositoryUrl: "https://example.com/repos/owner/repo" },
    });
  });
});
