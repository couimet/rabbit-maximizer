import "reflect-metadata";
import { config, describeRepoFilter } from "./config.js";
import { initLogger } from "./logger.js";
import { getLogger } from "@couimet/logger-contract";
import { container } from "./container.js";
import { TYPES } from "./inversify-types.js";
import type { PollDetector } from "./detectorPoll.js";

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

const detector = container.get<PollDetector>(TYPES.PollDetector);
const { stop } = detector.start();

const gracefulShutdown = () => {
  log.info({ fn: "main" }, "Stopping poll detector");
  stop();
  process.exit(0);
};

process.on("SIGTERM", gracefulShutdown);
process.on("SIGINT", gracefulShutdown);

// TODO: scheduler loop — issue #6
