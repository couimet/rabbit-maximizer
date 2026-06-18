import { describe, it, expect } from "@jest/globals";
import { buildCommentBody } from "../../src/github/buildCommentBody.js";

describe("buildCommentBody", () => {
  it("builds the retrigger comment with run marker, repo link, and trigger source", () => {
    const body = buildCommentBody(
      "https://github.com/owner/repo/issues/42#issuecomment-999",
      "run-abc",
    );

    const lines = body.split("\n");
    expect(lines[0]).toBe("@coderabbitai full review");
    expect(lines[1]).toBe("");
    expect(lines[2]).toContain("🔧 rabbit-optimizer v");
    expect(lines[2]).toContain(" run=run-abc");
    expect(lines[3]).toBe("");
    expect(lines[4]).toBe("---");
    expect(lines[5]).toBe("");
    expect(lines[6]).toContain("🤖 rabbit-optimizer | ");
    expect(lines[6]).toContain(" | v");
    expect(lines[6]).toContain(" | run=run-abc");
    expect(lines[7]).toBe(
      "↩ Triggered by: https://github.com/owner/repo/issues/42#issuecomment-999",
    );
  });
});
