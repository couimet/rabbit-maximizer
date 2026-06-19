import "reflect-metadata";
import { config, describeRepoFilter } from "./config.js";
import { initLogger } from "./logger.js";
import { getLogger } from "@couimet/logger-contract";
import { type PrismaClient } from "@prisma/client";
import { container } from "./container.js";
import { TYPES } from "./inversify-types.js";
import type { CoderabbitGitHubClient } from "./github/index.js";
import type { QueueRepository } from "./db/queueRepository.js";
import type { EventRepository } from "./db/eventRepository.js";
import { ProbeFactory } from "./probes/ProbeFactory.js";
import type { RateLimitComment } from "./types/index.js";

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

// One-shot connectivity check until detector/scheduler loops land (issues #5/#6).
const github = container.get<CoderabbitGitHubClient>(
  TYPES.CoderabbitGitHubClient,
);

let comments: RateLimitComment[] = [];
try {
  comments = await github.searchRateLimitComments(config.REPO_FILTER);
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

// One-shot DB smoke until the scheduler loop lands (issue #6): persist each
// detected comment (queue row + detected event), then read it all back.
let prisma: PrismaClient | undefined;
try {
  prisma = container.get<PrismaClient>(TYPES.PrismaClient);
  const queue = container.get<QueueRepository>(TYPES.QueueRepository);
  const events = container.get<EventRepository>(TYPES.EventRepository);
  const probes = container.get<ProbeFactory>(TYPES.ProbeFactory);

  // TODO(https://github.com/couimet/rabbit-optimizer/issues/6): Wrap queue
  // mutation and event probe calls in a transaction so queue state and the
  // audit trail cannot diverge if event persistence fails.
  for (const c of comments) {
    const queued = await queue.enqueue(
      c.repo_full_name,
      c.pr_number,
      new Date(),
    );
    const probe = probes.createDetectedProbe({
      repo_full_name: c.repo_full_name,
      pr_number: c.pr_number,
      source_ts: new Date(c.created_at),
      source_comment_url: c.url,
    });
    await probe.processStarted();
    await probe.processCompleted();
    log.info(
      {
        fn: "main",
        uuid: queued.uuid,
        repo: c.repo_full_name,
        pr: c.pr_number,
      },
      "Persisted detected PR",
    );
  }

  const pending = await queue.getPendingQueue();
  log.info(
    { fn: "main", count: pending.length },
    "Pending queue read back from the database",
  );
  for (const item of pending) {
    const history = await events.listForPr(item.repo_full_name, item.pr_number);
    log.info(
      {
        fn: "main",
        repo: item.repo_full_name,
        pr: item.pr_number,
        status: item.status,
        scheduled_for: item.scheduled_for,
        events: history.map((e) => e.type),
      },
      "Queue item with event history",
    );
  }
} catch (err) {
  log.warn(
    {
      fn: "main",
      error: err instanceof Error ? err.message : String(err),
    },
    "DB smoke test failed — has the migration been applied (pnpm db:migrate) and better-sqlite3 been built?",
  );
} finally {
  await prisma?.$disconnect();
}

// TODO: detector loop (poll / webhook) — issue #5
// TODO: scheduler loop — issue #6
