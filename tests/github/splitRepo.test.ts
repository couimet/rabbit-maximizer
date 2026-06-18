import { describe, it, expect } from "@jest/globals";
import { splitRepo } from "../../src/github/splitRepo.js";

describe("splitRepo", () => {
  it("splits an owner/repo string into its two parts", () => {
    expect(splitRepo("couimet/my-repo")).toStrictEqual({
      owner: "couimet",
      repo: "my-repo",
    });
  });
});
