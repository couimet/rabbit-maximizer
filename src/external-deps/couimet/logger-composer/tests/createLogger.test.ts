import type { LoggerEnricher } from '../../logger-enricher-contract/src/index.js';
import { createLogger } from '../src/index.js';

import type { Logger, LoggingContext } from '@couimet/logger-contract';
import { describe, expect, it, jest } from '@jest/globals';

const CALLER_CONTEXT: LoggingContext = { fn: 'someFunction' };
const MESSAGE = 'some message';
const FIRST_ENRICHMENT = { first: '1' };
const SECOND_ENRICHMENT = { second: '2' };

const createAdapter = (): Logger => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

describe('createLogger', () => {
  it('applies enrichments in array order per call', () => {
    const adapter = createAdapter();
    const firstEnricher: LoggerEnricher = { enrich: jest.fn((c: LoggingContext) => ({ ...c, ...FIRST_ENRICHMENT })) };
    const secondEnricher: LoggerEnricher = { enrich: jest.fn((c: LoggingContext) => ({ ...c, ...SECOND_ENRICHMENT })) };
    const logger = createLogger({ adapter, enrichments: [firstEnricher, secondEnricher] });

    logger.info(CALLER_CONTEXT, MESSAGE);

    expect(firstEnricher.enrich).toHaveBeenCalledWith(CALLER_CONTEXT);
    expect(secondEnricher.enrich).toHaveBeenCalledWith({ ...CALLER_CONTEXT, ...FIRST_ENRICHMENT });
    expect(adapter.info).toHaveBeenCalledWith({ ...CALLER_CONTEXT, ...FIRST_ENRICHMENT, ...SECOND_ENRICHMENT }, MESSAGE);
  });

  it('passes the context through unchanged without enrichments', () => {
    const adapter = createAdapter();
    const logger = createLogger({ adapter, enrichments: [] });

    logger.warn(CALLER_CONTEXT, MESSAGE);

    expect(adapter.warn).toHaveBeenCalledWith(CALLER_CONTEXT, MESSAGE);
  });

  it('delegates every log level through the composed instance', () => {
    const adapter = createAdapter();
    const logger = createLogger({ adapter, enrichments: [] });

    logger.debug(CALLER_CONTEXT, MESSAGE);
    logger.info(CALLER_CONTEXT, MESSAGE);
    logger.warn(CALLER_CONTEXT, MESSAGE);
    logger.error(CALLER_CONTEXT, MESSAGE);

    expect(adapter.debug).toHaveBeenCalledWith(CALLER_CONTEXT, MESSAGE);
    expect(adapter.info).toHaveBeenCalledWith(CALLER_CONTEXT, MESSAGE);
    expect(adapter.warn).toHaveBeenCalledWith(CALLER_CONTEXT, MESSAGE);
    expect(adapter.error).toHaveBeenCalledWith(CALLER_CONTEXT, MESSAGE);
  });
});
