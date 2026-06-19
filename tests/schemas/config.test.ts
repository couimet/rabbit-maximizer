import { describe, it, expect, beforeEach } from "@jest/globals";
import { getRandomString } from "@couimet/dynamic-testing";
import { ConfigSchema } from "../../src/schemas/config.js";

describe("ConfigSchema", () => {
  let githubPat: string;
  let webhookSecret: string;
  let tunnelUrl: string;
  let BASE: ReturnType<typeof ConfigSchema.safeParse> extends {
    success: true;
    data: infer D;
  }
    ? D
    : never;

  beforeEach(() => {
    githubPat = getRandomString({ charset: "alphanumeric", length: 20 });
    webhookSecret = getRandomString({ charset: "alphanumeric", length: 16 });
    tunnelUrl = `https://${getRandomString({ charset: "alpha", length: 8 })}.com`;
    BASE = {
      DETECTION_MODE: "poll" as const,
      GITHUB_PAT: githubPat,
      POLL_INTERVAL: 90,
      DATABASE_URL: "file:./data/rabbit-optimizer.db",
      REPO_FILTER: [{ pattern: "couimet/*", scope: "user" as const }],
    };
  });

  // -- Success cases -----------------------------------------------------------

  it("accepts a valid poll config", () => {
    expect(ConfigSchema.safeParse(BASE).success).toBe(true);
  });

  it("accepts a valid webhook config with both webhook vars", () => {
    expect(
      ConfigSchema.safeParse({
        ...BASE,
        DETECTION_MODE: "webhook",
        WEBHOOK_SECRET: webhookSecret,
        TUNNEL_URL: tunnelUrl,
      }).success,
    ).toBe(true);
  });

  it("applies default DETECTION_MODE when missing", () => {
    const { DETECTION_MODE: _, ...rest } = BASE;
    const result = ConfigSchema.safeParse(rest);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.DETECTION_MODE).toBe("poll");
    }
  });

  it("applies default POLL_INTERVAL when missing", () => {
    const { POLL_INTERVAL: _, ...rest } = BASE;
    const result = ConfigSchema.safeParse(rest);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.POLL_INTERVAL).toBe(90);
    }
  });

  it("coerces numeric POLL_INTERVAL from a string", () => {
    const result = ConfigSchema.safeParse({ ...BASE, POLL_INTERVAL: "120" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.POLL_INTERVAL).toBe(120);
    }
  });

  // -- Failure cases -----------------------------------------------------------

  it("rejects an invalid DETECTION_MODE", () => {
    expect(
      ConfigSchema.safeParse({ ...BASE, DETECTION_MODE: "invalid" }).success,
    ).toBe(false);
  });

  it("rejects missing GITHUB_PAT", () => {
    const { GITHUB_PAT: _, ...rest } = BASE;
    const result = ConfigSchema.safeParse(rest);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some((i) => i.path.includes("GITHUB_PAT")),
      ).toBe(true);
    }
  });

  it("rejects empty GITHUB_PAT", () => {
    expect(ConfigSchema.safeParse({ ...BASE, GITHUB_PAT: "" }).success).toBe(
      false,
    );
  });

  it("rejects negative POLL_INTERVAL", () => {
    expect(ConfigSchema.safeParse({ ...BASE, POLL_INTERVAL: -5 }).success).toBe(
      false,
    );
  });

  it("rejects empty REPO_FILTER array", () => {
    expect(ConfigSchema.safeParse({ ...BASE, REPO_FILTER: [] }).success).toBe(
      false,
    );
  });

  it("rejects REPO_FILTER with empty pattern strings", () => {
    expect(
      ConfigSchema.safeParse({
        ...BASE,
        REPO_FILTER: [{ pattern: "", scope: "user" as const }],
      }).success,
    ).toBe(false);
  });

  // -- Webhook refinement ------------------------------------------------------

  it("rejects webhook mode without WEBHOOK_SECRET", () => {
    const result = ConfigSchema.safeParse({
      ...BASE,
      DETECTION_MODE: "webhook",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some((i) => i.path.includes("WEBHOOK_SECRET")),
      ).toBe(true);
    }
  });

  it("rejects webhook mode without TUNNEL_URL", () => {
    const result = ConfigSchema.safeParse({
      ...BASE,
      DETECTION_MODE: "webhook",
      WEBHOOK_SECRET: webhookSecret,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some((i) => i.path.includes("TUNNEL_URL")),
      ).toBe(true);
    }
  });

  it("rejects webhook mode with empty WEBHOOK_SECRET string", () => {
    expect(
      ConfigSchema.safeParse({
        ...BASE,
        DETECTION_MODE: "webhook",
        WEBHOOK_SECRET: "",
        TUNNEL_URL: tunnelUrl,
      }).success,
    ).toBe(false);
  });
});
