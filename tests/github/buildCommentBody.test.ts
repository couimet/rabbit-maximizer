import { describe, it, expect } from "@jest/globals";
import { buildCommentBody } from "../../src/github/buildCommentBody.js";
import pkg from "../../package.json" with { type: "json" };

const VERSION = pkg.version;
const REPO_URL = pkg.repository.url;

describe("buildCommentBody", () => {
  it("builds the retrigger comment with run marker, repo link, and trigger source", () => {
    const body = buildCommentBody(
      "https://github.com/owner/repo/issues/42#issuecomment-999",
      "run-abc",
    );

    const lines = body.split("\n");
    expect(lines[0]).toBe("@coderabbitai full review");
    expect(lines[1]).toBe("");
    expect(lines[2]).toBe(`🔧 rabbit-optimizer v${VERSION} run=run-abc`);
    expect(lines[3]).toBe("");
    expect(lines[4]).toBe("---");
    expect(lines[5]).toBe("");
    expect(lines[6]).toBe(
      `🤖 rabbit-optimizer | ${REPO_URL} | v${VERSION} | run=run-abc`,
    );
    expect(lines[7]).toBe(
      "↩ Triggered by: https://github.com/owner/repo/issues/42#issuecomment-999",
    );
  });
});
