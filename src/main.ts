import { config, describeRepoFilter } from './config.js';
import { container } from './container.js';
import type { PollDetector } from './detectorPoll.js';
import { TYPES } from './inversify-types.js';
import { initLogger } from './logger.js';

import 'reflect-metadata';
import { getLogger } from '@couimet/logger-contract';

initLogger();
const log = getLogger();

log.info({ fn: 'main' }, `rabbit-maximizer starting — DETECTION_MODE=${config.DETECTION_MODE}`);
log.info({ fn: 'main' }, `Watching repos: ${describeRepoFilter(config.REPO_FILTER)}`);

const detector = container.get<PollDetector>(TYPES.PollDetector);
const { stop } = detector.start();

const gracefulShutdown = () => {
  log.info({ fn: 'main' }, 'Stopping poll detector');
  void stop().then(() => process.exit(0));
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

// TODO: scheduler loop — issue #6
