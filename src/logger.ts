import { setLogger } from '@couimet/logger-contract';
import { PinoAdapter } from '@couimet/logger-contract-adapters';
import { mkdirSync } from 'node:fs';
import pino from 'pino';

const LOG_FILE = './logs/rabbit-maximizer.log';
const STDOUT_FD = 1;

export const initLogger = (): void => {
  mkdirSync('./logs', { recursive: true });

  const transport = pino.transport({
    targets: [
      {
        target: 'pino/file',
        options: { destination: LOG_FILE },
      },
      {
        target: 'pino-pretty',
        options: { destination: STDOUT_FD, colorize: true },
      },
    ],
  });

  setLogger(new PinoAdapter(pino(transport)));
};
