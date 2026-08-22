import type { LoggerEnricher } from '../../logger-enricher-contract/src/index.js';

import type { Logger, LoggingContext } from '@couimet/logger-contract';

export interface CreateLoggerParams {
  readonly adapter: Logger;
  readonly enrichments: readonly LoggerEnricher[];
}

export const createLogger = ({ adapter, enrichments }: CreateLoggerParams): Logger => {
  const enrich = (context: LoggingContext): LoggingContext => enrichments.reduce((accumulated, enricher) => enricher.enrich(accumulated), context);

  return {
    debug: (context, message) => adapter.debug(enrich(context), message),
    info: (context, message) => adapter.info(enrich(context), message),
    warn: (context, message) => adapter.warn(enrich(context), message),
    error: (context, message) => adapter.error(enrich(context), message),
  };
};
