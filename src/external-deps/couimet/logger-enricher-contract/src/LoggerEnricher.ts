import type { LoggingContext } from '@couimet/logger-contract';

export interface LoggerEnricher {
  enrich(context: LoggingContext): LoggingContext;
}
