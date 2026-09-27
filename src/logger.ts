import { createLogger } from './external-deps/couimet/logger-composer/src/index.js';
import { executionContextEnricher } from './external-deps/couimet/logger-enricher-execution-context/src/index.js';

import { setLogger } from '@couimet/logger-contract';
import { PinoAdapter } from '@couimet/logger-contract-adapters';
import pino, { type TransportTargetOptions } from 'pino';

const DEFAULT_LOGS_DIR = './logs';
const LOG_FILE_NAME = 'rabbit-maximizer.log';
const STDOUT_FD = 1;
const ROTATED_FILES_TO_KEEP = 7;
const DEFAULT_LOG_LEVEL = 'debug';

export const initLogger = (): void => {
  const logLevel = process.env.LOG_LEVEL ?? DEFAULT_LOG_LEVEL;
  const logsDir = process.env.RABBIT_MAXIMIZER_LOGS_DIR ?? DEFAULT_LOGS_DIR;
  const logToFile = process.env.LOG_TO_FILE !== 'false';

  const fileTarget = {
    target: 'pino-roll',
    options: { file: `${logsDir}/${LOG_FILE_NAME}`, frequency: 'daily', mkdir: true, limit: { count: ROTATED_FILES_TO_KEEP } },
    level: logLevel,
  };
  const stdoutTarget = {
    target: 'pino-pretty',
    options: { destination: STDOUT_FD, colorize: true },
    level: logLevel,
  };

  // The explicit annotation keeps both targets in one array: pino infers the
  // option type from the first element, which rejects the second shape.
  const targets: TransportTargetOptions[] = logToFile ? [fileTarget, stdoutTarget] : [stdoutTarget];

  const transport = pino.transport({ targets });

  setLogger(createLogger({ adapter: new PinoAdapter(pino({ level: logLevel }, transport)), enrichments: [executionContextEnricher] }));
};
