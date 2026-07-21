import { PrScannerProbe } from '../../src/probes/PrScannerProbe.js';

import { getUniqueInt, getUniqueString } from '@couimet/dynamic-testing';
import { createMockLogger } from '@couimet/logger-contract-testing';
import { beforeEach, describe, expect, it } from '@jest/globals';

describe('PrScannerProbe', () => {
  let logger: ReturnType<typeof createMockLogger>;
  let observation: { correlationId: string; requestId: string; version: string };

  beforeEach(() => {
    logger = createMockLogger();
    observation = {
      correlationId: getUniqueString(),
      requestId: getUniqueString(),
      version: '1.0.0',
    };
  });

  const createProbe = () => new PrScannerProbe(observation, logger);

  describe('scanStarted', () => {
    it('logs info when scan starts', () => {
      createProbe().scanStarted();

      expect(logger.info).toHaveBeenCalledWith({ fn: 'PrScannerProbe.scanStarted' }, 'PR scan started');
    });
  });

  describe('skipped', () => {
    it('logs debug when scan is skipped within interval', () => {
      const elapsedMs = getUniqueInt();
      createProbe().skipped(elapsedMs);

      expect(logger.debug).toHaveBeenCalledWith({ fn: 'PrScannerProbe.skipped', elapsedMs }, 'Skipping scan; within interval');
    });
  });

  describe('discovered', () => {
    it('logs info with opened and updated counts', () => {
      const opened = getUniqueInt();
      const updated = getUniqueInt();
      createProbe().discovered(opened, updated);

      expect(logger.info).toHaveBeenCalledWith({ fn: 'PrScannerProbe.discovered', opened, updated }, 'PRs discovered from scan');
    });
  });

  describe('detectedClosures', () => {
    it('logs info with closed count', () => {
      const count = getUniqueInt();
      createProbe().detectedClosures(count);

      expect(logger.info).toHaveBeenCalledWith({ fn: 'PrScannerProbe.detectedClosures', count }, 'Closed PRs detected during scan');
    });
  });

  describe('caughtError', () => {
    it('logs warn with repo, pr, and error', () => {
      const repo = getUniqueString({ prefix: 'org/' });
      const pr = getUniqueInt();
      const err = new Error('API error');
      createProbe().caughtError(repo, pr, err);

      expect(logger.warn).toHaveBeenCalledWith({ fn: 'PrScannerProbe.caughtError', repo, pr, error: err }, 'Error processing PR during scan');
    });
  });

  describe('failed', () => {
    it('logs error with the top-level scan failure', () => {
      const err = new Error('GitHub API unreachable');
      createProbe().failed(err);

      expect(logger.error).toHaveBeenCalledWith({ fn: 'PrScannerProbe.failed', error: err }, 'PR scan failed');
    });
  });

  describe('failedToPersistLastScanAt', () => {
    it('logs warn when persisting lastScanAt fails', () => {
      const err = new Error('DB write failed');
      createProbe().failedToPersistLastScanAt(err);

      expect(logger.warn).toHaveBeenCalledWith({ fn: 'PrScannerProbe.failedToPersistLastScanAt', error: err }, 'Failed to persist lastScanAt; continuing');
    });
  });

  describe('completed', () => {
    it('logs info with opened, updated, and closed counts', () => {
      const opened = getUniqueInt();
      const updated = getUniqueInt();
      const closed = getUniqueInt();
      createProbe().completed(opened, updated, closed);

      expect(logger.info).toHaveBeenCalledWith({ fn: 'PrScannerProbe.completed', opened, updated, closed }, 'PR scan completed');
    });
  });
});
