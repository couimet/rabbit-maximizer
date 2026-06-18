import { config } from "./config.js";
import { initLogger } from "./logger.js";
import { getLogger } from "@couimet/logger-contract";

initLogger();
const log = getLogger();

log.info(
  { fn: "main" },
  `rabbit-optimizer starting — DETECTION_MODE=${config.DETECTION_MODE}`,
);
log.info({ fn: "main" }, `Watching repos: ${config.REPO_FILTER.join(", ")}`);

// TODO: detector loop (poll / webhook) — next issue
