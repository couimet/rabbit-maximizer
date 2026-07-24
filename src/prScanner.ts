import { type PullRequestRepository, StateKey, type SystemStateRepository } from './db/index.js';
import { type CoderabbitGitHubClient, isPRClosedWithoutMerge, isPRMerged } from './github/index.js';
import type { ProbeFactory } from './probes/index.js';
import type { ScannedPR, ScanResult } from './types/index.js';
import { MS_PER_SECOND } from './utils/index.js';
import type { Config } from './config.js';
import { getPrStateFromGitHubValue, PrState, TYPES } from './domain.js';

import type { Logger } from '@couimet/logger-contract';
import { inject, injectable } from 'inversify';

export interface PrScanner {
  scan(): Promise<ScanResult>;
}

@injectable()
export class PrScannerImpl implements PrScanner {
  /* c8 ignore start — decorator emit branches */
  constructor(
    @inject(TYPES.CoderabbitGitHubClient)
    private readonly github: CoderabbitGitHubClient,
    @inject(TYPES.PullRequestRepository)
    private readonly pullRequests: PullRequestRepository,
    @inject(TYPES.ProbeFactory)
    private readonly probeFactory: ProbeFactory,
    @inject(TYPES.SystemStateRepository)
    private readonly systemState: SystemStateRepository,
    @inject(TYPES.Config)
    private readonly config: Config,
    @inject(TYPES.Logger)
    private readonly log: Logger,
  ) {}
  /* c8 ignore stop */

  async scan(): Promise<ScanResult> {
    const probe = this.probeFactory.createPrScannerProbe();

    const now = new Date();

    let opened = 0;
    let updated = 0;
    const scannedPRs: ScannedPR[] = [];
    let scanResult: ScanResult = { opened: 0, updated: 0, scannedPRs: [] };

    probe.scanStarted();

    const lastScanCompletedAt = await this.systemState.getState(StateKey.lastScanCompletedAt);
    if (lastScanCompletedAt) {
      const elapsedMs = now.getTime() - lastScanCompletedAt.getTime();
      const intervalMs = this.config.PR_SCANNER_INTERVAL_SEC * MS_PER_SECOND;
      if (elapsedMs < intervalMs) {
        probe.skipped(elapsedMs, intervalMs);
        return scanResult;
      }
    }

    try {
      await this.systemState.setState(StateKey.lastScanStartedAt, now);
    } catch (err: unknown) {
      probe.failedToPersistScanStartedAt(err);
    }

    try {
      const discoveredPRs = await this.github.listOpenPRs(this.config.REPO_FILTER);
      const discoveredKeys = new Set(discoveredPRs.map((p) => `${p.repoFullName}#${p.prNumber}`));

      // Upsert each discovered PR
      for (const pr of discoveredPRs) {
        try {
          const result = await this.pullRequests.upsert(pr.repoFullName, pr.prNumber, {
            prTitle: pr.prTitle,
            prState: PrState.open,
            authorLogin: pr.authorLogin,
          });
          scannedPRs.push({ repoFullName: pr.repoFullName, prNumber: pr.prNumber, pullRequestId: result.id, prTitle: pr.prTitle });
          if (result.created) {
            opened++;
          } else {
            updated++;
          }
        } catch (err: unknown) {
          probe.caughtError(pr.repoFullName, pr.prNumber, err);
        }
      }

      probe.discovered(opened, updated);

      // Detect closures: PRs in DB with pr_state='open' but not in GitHub's open list
      const dbOpenPRs = await this.pullRequests.findByPrState(PrState.open);
      let closed = 0;
      for (const dbPR of dbOpenPRs) {
        const key = `${dbPR.repo_full_name}#${dbPR.pr_number}`;
        if (!discoveredKeys.has(key)) {
          try {
            const prState = await this.github.getPRState(dbPR.repo_full_name, dbPR.pr_number);
            void getPrStateFromGitHubValue(prState.state);
            if (isPRMerged(prState)) {
              await this.pullRequests.upsert(dbPR.repo_full_name, dbPR.pr_number, { prState: PrState.merged });
              closed++;
            } else if (isPRClosedWithoutMerge(prState)) {
              await this.pullRequests.upsert(dbPR.repo_full_name, dbPR.pr_number, { prState: PrState.closed });
              closed++;
            }
          } catch (err: unknown) {
            probe.caughtError(dbPR.repo_full_name, dbPR.pr_number, err);
          }
        }
      }

      if (closed > 0) {
        probe.detectedClosures(closed);
      }

      try {
        await this.systemState.setState(StateKey.lastScanCompletedAt, new Date());
      } catch (err: unknown) {
        probe.failedToPersistScanCompletedAt(err);
      }

      probe.completed(opened, updated, closed);

      scanResult = { opened, updated, scannedPRs };
    } catch (err: unknown) {
      probe.failed(err);
    }

    return scanResult;
  }
}
