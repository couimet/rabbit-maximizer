import "reflect-metadata";
import { config, describeRepoFilter } from "./config.js";
import { initLogger } from "./logger.js";
import { getLogger } from "@couimet/logger-contract";
import { container } from "./container.js";
import { TYPES } from "./inversify-types.js";
import type { CoderabbitGitHubClient } from "./github/index.js";

initLogger();
const log = getLogger();

log.info(
  { fn: "main" },
  `rabbit-optimizer starting — DETECTION_MODE=${config.DETECTION_MODE}`,
);
log.info(
  { fn: "main" },
  `Watching repos: ${describeRepoFilter(config.REPO_FILTER)}`,
);

// Smoke test: resolve the GitHub client and verify connectivity by counting
// rate-limit comments across the configured repos. This is a one-shot check —
// the poll detector and scheduler loops are wired in future issues.
const github = container.get<CoderabbitGitHubClient>(
  TYPES.CoderabbitGitHubClient,
);

try {
  const comments = await github.searchRateLimitComments(config.REPO_FILTER);
  log.info(
    { fn: "main", count: comments.length },
    `GitHub API connectivity verified. Found ${comments.length} rate-limit comment(s) across configured repos.`,
  );
  for (const c of comments) {
    log.info(
      {
        fn: "main",
        repo: c.repo_full_name,
        pr: c.pr_number,
        comment_id: c.comment_id,
        url: c.url,
        created_at: c.created_at,
      },
      `Rate-limit comment in ${c.repo_full_name}#${c.pr_number}`,
    );
  }
} catch (err) {
  log.warn(
    {
      fn: "main",
      error: err instanceof Error ? err.message : String(err),
    },
    "GitHub API smoke test failed — verify GITHUB_PAT and network connectivity. The tool will still start but detection may not work.",
  );
}

// TODO: detector loop (poll / webhook) — issue #5
// TODO: scheduler loop — issue #6
