import type { ObservationContext } from '../observability/observationContext.js';

import type { Logger } from '@couimet/logger-contract';

export class PrScannerProbe {
  constructor(
    private readonly observation: ObservationContext,
    private readonly log: Logger,
  ) {}

  skipped(elapsedMs: number): void {
    this.log.debug({ fn: 'PrScannerProbe.skipped', elapsedMs }, 'Skipping scan; within interval');
  }

  scanStarted(): void {
    this.log.info({ fn: 'PrScannerProbe.scanStarted' }, 'PR scan started');
  }

  discovered(opened: number, updated: number): void {
    this.log.info({ fn: 'PrScannerProbe.discovered', opened, updated }, 'PRs discovered from scan');
  }

  detectedClosures(count: number): void {
    this.log.info({ fn: 'PrScannerProbe.detectedClosures', count }, 'Closed PRs detected during scan');
  }

  caughtError(repo: string, pr: number, err: unknown): void {
    this.log.warn({ fn: 'PrScannerProbe.caughtError', repo, pr, error: err }, 'Error processing PR during scan');
  }

  failed(err: unknown): void {
    this.log.error({ fn: 'PrScannerProbe.failed', error: err }, 'PR scan failed');
  }

  failedToPersistLastScanAt(err: unknown): void {
    this.log.warn({ fn: 'PrScannerProbe.failedToPersistLastScanAt', error: err }, 'Failed to persist lastScanAt; continuing');
  }

  completed(opened: number, updated: number, closed: number): void {
    this.log.info({ fn: 'PrScannerProbe.completed', opened, updated, closed }, 'PR scan completed');
  }
}
