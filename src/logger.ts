import { Logger, LoggingContext, setLogger } from '@couimet/logger-contract';

/** Ensure `fn` appears first in the serialized context. */
const orderedCtx = (ctx: LoggingContext): Record<string, unknown> => {
  const { fn, ...rest } = ctx;
  return { fn, ...rest };
};

const log =
  (level: string, sink: (msg: string) => void) =>
  (ctx: LoggingContext, message: string): void => {
    sink(`[${level}] ${JSON.stringify(orderedCtx(ctx))} ${message}`);
  };

class ConsoleLogger implements Logger {
  debug = log('DEBUG', console.debug);
  info = log('INFO', console.info);
  warn = log('WARN', console.warn);
  error = log('ERROR', console.error);
}

export const initLogger = (): void => {
  setLogger(new ConsoleLogger());
};
