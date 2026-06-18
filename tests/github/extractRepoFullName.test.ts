import { describe, it, expect } from "@jest/globals";
import { extractRepoFullName } from "../../src/github/extractRepoFullName.js";

describe("extractRepoFullName", () => {
  it("strips the GitHub API repository prefix", () => {
    expect(
      extractRepoFullName("https://api.github.com/repos/couimet/my-repo"),
    ).toBe("couimet/my-repo");
  });
});
