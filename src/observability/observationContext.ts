import pkg from '../../package.json' with { type: 'json' };

import { injectable } from 'inversify';
import { randomUUID } from 'node:crypto';

/** Correlation/request ids plus the app version that wrote a given event. */
export interface ObservationContext {
  readonly correlationId: string;
  readonly requestId?: string;
  readonly version: string;
}

export interface ObservationContextProvider {
  current(): ObservationContext;
}

/**
 * Interim provider that mints uuidv4 ids per call. Swapped for an
 * ExecutionContext-backed provider once
 * https://github.com/couimet/ts-npm-packages/issues/5 publishes; the interface
 * is unchanged so callers are unaffected.
 */
@injectable()
export class UuidObservationContextProvider implements ObservationContextProvider {
  current(): ObservationContext {
    return {
      correlationId: randomUUID(),
      requestId: randomUUID(),
      version: pkg.version,
    };
  }
}
