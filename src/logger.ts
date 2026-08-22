import { createLogger } from './external-deps/couimet/logger-composer/src/index.js';
import { executionContextEnricher } from './external-deps/couimet/logger-enricher-execution-context/src/index.js';

import { setLogger } from '@couimet/logger-contract';
import { PinoAdapter } from '@couimet/logger-contract-adapters';
import pino from 'pino';

const LOG_FILE = './logs/rabbit-maximizer.log';
const STDOUT_FD = 1;
const ROTATED_FILES_TO_KEEP = 7;
const LOG_LEVEL = process.env.LOG_LEVEL ?? 'debug';

export const initLogger = (): void => {
  const transport = pino.transport({
    targets: [
      {
        target: 'pino-roll',
        options: { file: LOG_FILE, frequency: 'daily', mkdir: true, limit: { count: ROTATED_FILES_TO_KEEP } },
        level: LOG_LEVEL,
      },
      {
        target: 'pino-pretty',
        options: { destination: STDOUT_FD, colorize: true },
        level: LOG_LEVEL,
      },
    ],
  });

  setLogger(createLogger({ adapter: new PinoAdapter(pino({ level: LOG_LEVEL }, transport)), enrichments: [executionContextEnricher] }));
};
