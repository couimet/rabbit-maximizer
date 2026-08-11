import type { Config } from '../src/config.js';
import type { PullRequestRepository, SystemStateRepository } from '../src/db/index.js';
import { getUniqueStringsNamed } from '../src/external-deps/couimet/dynamic-testing/unique.js';
import type { CoderabbitGitHubClient } from '../src/github/index.js';
import type { ProbeFactory } from '../src/probes/index.js';
import { PrScannerImpl } from '../src/services.js';
import type { DiscoveredPR } from '../src/types/index.js';

import {
  createMockCoderabbitGitHubClient,
  createMockProbeFactory,
  createMockPrScannerProbe,
  createMockPullRequestRepo,
  createMockSystemStateRepository,
  generateReviewRef,
  type MockPrScannerProbe,
} from './helpers/index.js';

import { getUniqueDate, getUniqueInt } from '@couimet/dynamic-testing';
import type { Logger } from '@couimet/logger-contract';
import { createMockLogger } from '@couimet/logger-contract-testing';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const INTERVAL_SEC = 300;
const MS_PER_SECOND = 1000;

describe('PrScannerImpl', () => {
  let github: jest.Mocked<CoderabbitGitHubClient>;
  let pullRequests: jest.Mocked<PullRequestRepository>;
  let systemState: jest.Mocked<SystemStateRepository>;
  let probeFactory: jest.Mocked<ProbeFactory>;
  let config: Config;
  let log: Logger;
  let prScannerProbe: MockPrScannerProbe;

  beforeEach(() => {
    github = createMockCoderabbitGitHubClient();
    pullRequests = createMockPullRequestRepo();
    systemState = createMockSystemStateRepository();
    prScannerProbe = createMockPrScannerProbe();
    probeFactory = createMockProbeFactory({
      createPrScannerProbe: jest.fn(() => prScannerProbe),
    });
    config = {
      PR_SCANNER_INTERVAL_SEC: INTERVAL_SEC,
      REPO_FILTER: [{ pattern: 'owner/*', scope: 'user' as const }],
    } as Config;
    log = createMockLogger();
  });

  const createScanner = () => new PrScannerImpl(github, pullRequests, probeFactory, systemState, config, log);

  it('discovers PRs and calls upsert with prState:open for each', async () => {
    const ref1 = generateReviewRef();
    const ref2 = generateReviewRef();
    const { prTitle1, authorLogin1, prTitle2, authorLogin2 } = getUniqueStringsNamed(['prTitle1', 'authorLogin1', 'prTitle2', 'authorLogin2']);

    const pr1: DiscoveredPR = { repoFullName: ref1.repoFullName, prNumber: ref1.prNumber, prTitle: prTitle1, authorLogin: authorLogin1 };
    const pr2: DiscoveredPR = { repoFullName: ref2.repoFullName, prNumber: ref2.prNumber, prTitle: prTitle2, authorLogin: authorLogin2 };

    github.listOpenPRs.mockResolvedValue([pr1, pr2]);
    pullRequests.upsert.mockResolvedValueOnce({ id: 1, created: true }).mockResolvedValueOnce({ id: 2, created: false });
    pullRequests.findByPrState.mockResolvedValue([]);

    const scanner = createScanner();
    await scanner.scan();

    expect(pullRequests.upsert).toHaveBeenCalledWith(ref1.repoFullName, ref1.prNumber, { prTitle: prTitle1, prState: 'open', authorLogin: authorLogin1 });
    expect(pullRequests.upsert).toHaveBeenCalledWith(ref2.repoFullName, ref2.prNumber, { prTitle: prTitle2, prState: 'open', authorLogin: authorLogin2 });
    expect(prScannerProbe.scanStarted).toHaveBeenCalled();
    expect(prScannerProbe.discovered).toHaveBeenCalledWith(1, 1);
    expect(prScannerProbe.completed).toHaveBeenCalledWith(1, 1, 0);
  });

  it('detects closures: updates DB PRs not in GitHub open list with correct prState and timestamps', async () => {
    const openRef = generateReviewRef();
    const mergedRef = generateReviewRef();
    const closedRef = generateReviewRef();
    const { prTitle, authorLogin } = getUniqueStringsNamed(['prTitle', 'authorLogin']);

    const mergedDate = getUniqueDate();
    const closedDate = getUniqueDate();
    const mergedAt = mergedDate.toISOString();
    const closedAt = closedDate.toISOString();

    const discoveredPR: DiscoveredPR = { repoFullName: openRef.repoFullName, prNumber: openRef.prNumber, prTitle, authorLogin };
    const dbOpenPRs = [
      { id: getUniqueInt(), repo_full_name: openRef.repoFullName, pr_number: openRef.prNumber },
      { id: getUniqueInt(), repo_full_name: mergedRef.repoFullName, pr_number: mergedRef.prNumber },
      { id: getUniqueInt(), repo_full_name: closedRef.repoFullName, pr_number: closedRef.prNumber },
    ];

    github.listOpenPRs.mockResolvedValue([discoveredPR]);
    pullRequests.findByPrState.mockResolvedValue(dbOpenPRs);
    github.getPRState
      .mockResolvedValueOnce({ state: 'closed', merged_at: mergedAt, closed_at: mergedAt })
      .mockResolvedValueOnce({ state: 'closed', merged_at: null, closed_at: closedAt });

    const scanner = createScanner();
    await scanner.scan();

    expect(pullRequests.upsert).toHaveBeenCalledWith(mergedRef.repoFullName, mergedRef.prNumber, { prState: 'merged', mergedAt: mergedDate });
    expect(pullRequests.upsert).toHaveBeenCalledWith(closedRef.repoFullName, closedRef.prNumber, { prState: 'closed', closedAt: closedDate });
    expect(github.getPRState).toHaveBeenCalledTimes(2);
    expect(prScannerProbe.detectedClosures).toHaveBeenCalledWith(2);
    expect(prScannerProbe.completed).toHaveBeenCalledWith(1, 0, 2);
  });

  it('respects interval gate: skips via probe when last scan is within interval', async () => {
    const intervalMs = INTERVAL_SEC * MS_PER_SECOND;
    systemState.getLastScanCompletedAt.mockResolvedValue(new Date());

    const scanner = createScanner();
    await scanner.scan();

    expect(prScannerProbe.scanStarted).toHaveBeenCalledTimes(1);
    expect(prScannerProbe.skipped).toHaveBeenCalledWith(expect.any(Number), intervalMs);
    expect(systemState.setLastScanStartedAt).not.toHaveBeenCalled();
  });

  it('handles per-PR errors gracefully without stopping the scan', async () => {
    const ref1 = generateReviewRef();
    const ref2 = generateReviewRef();

    const { prTitle: prTitle1, authorLogin: authorLogin1 } = getUniqueStringsNamed(['prTitle', 'authorLogin']);
    const { prTitle: prTitle2, authorLogin: authorLogin2 } = getUniqueStringsNamed(['prTitle', 'authorLogin']);

    const pr1: DiscoveredPR = { repoFullName: ref1.repoFullName, prNumber: ref1.prNumber, prTitle: prTitle1, authorLogin: authorLogin1 };
    const pr2: DiscoveredPR = { repoFullName: ref2.repoFullName, prNumber: ref2.prNumber, prTitle: prTitle2, authorLogin: authorLogin2 };

    github.listOpenPRs.mockResolvedValue([pr1, pr2]);
    const dbError = new Error('DB connection failed');
    pullRequests.upsert.mockRejectedValueOnce(dbError).mockResolvedValueOnce({ id: 2, created: false });
    pullRequests.findByPrState.mockResolvedValue([]);

    const scanner = createScanner();
    await scanner.scan();

    expect(pullRequests.upsert).toHaveBeenCalledTimes(2);
    expect(prScannerProbe.caughtError).toHaveBeenCalledWith(ref1.repoFullName, ref1.prNumber, dbError);
    expect(prScannerProbe.discovered).toHaveBeenCalledWith(0, 1);
    expect(prScannerProbe.completed).toHaveBeenCalledWith(0, 1, 0);
  });

  it('handles per-PR errors in closure detection without stopping the scan', async () => {
    const openRef = generateReviewRef();
    const failRef = generateReviewRef();

    const { prTitle, authorLogin } = getUniqueStringsNamed(['prTitle', 'authorLogin']);
    const discoveredPR: DiscoveredPR = { repoFullName: openRef.repoFullName, prNumber: openRef.prNumber, prTitle, authorLogin };
    const dbOpenPRs = [
      { id: getUniqueInt(), repo_full_name: openRef.repoFullName, pr_number: openRef.prNumber },
      { id: getUniqueInt(), repo_full_name: failRef.repoFullName, pr_number: failRef.prNumber },
    ];

    github.listOpenPRs.mockResolvedValue([discoveredPR]);
    pullRequests.findByPrState.mockResolvedValue(dbOpenPRs);
    const apiError = new Error('GitHub API error');
    github.getPRState.mockRejectedValueOnce(apiError);

    const scanner = createScanner();
    await scanner.scan();

    expect(prScannerProbe.caughtError).toHaveBeenCalledWith(failRef.repoFullName, failRef.prNumber, apiError);
    expect(prScannerProbe.completed).toHaveBeenCalledWith(1, 0, 0);
  });

  it('handles top-level scan failure and calls probe.failed', async () => {
    const scanError = new Error('GitHub API unreachable');
    github.listOpenPRs.mockRejectedValue(scanError);

    const scanner = createScanner();
    await scanner.scan();

    expect(prScannerProbe.failed).toHaveBeenCalledWith(scanError);
  });

  it('handles setState failure gracefully and still completes', async () => {
    const setStateError = new Error('DB write failed');
    systemState.setLastScanStartedAt.mockRejectedValue(setStateError);
    systemState.setLastScanCompletedAt.mockRejectedValue(setStateError);
    github.listOpenPRs.mockResolvedValue([]);
    pullRequests.findByPrState.mockResolvedValue([]);

    const scanner = createScanner();
    await scanner.scan();

    expect(prScannerProbe.failedToPersistScanStartedAt).toHaveBeenCalledWith(setStateError);
    expect(prScannerProbe.failedToPersistScanCompletedAt).toHaveBeenCalledWith(setStateError);
    expect(prScannerProbe.failed).not.toHaveBeenCalled();
    expect(prScannerProbe.completed).toHaveBeenCalledWith(0, 0, 0);
  });

  it('handles top-level scan failure when setState also fails', async () => {
    const scanError = new Error('GitHub API unreachable');
    const setStateError = new Error('DB write failed');
    github.listOpenPRs.mockRejectedValue(scanError);
    systemState.setLastScanStartedAt.mockRejectedValue(setStateError);

    const scanner = createScanner();
    await scanner.scan();

    expect(prScannerProbe.failed).toHaveBeenCalledWith(scanError);
    expect(prScannerProbe.failedToPersistScanStartedAt).toHaveBeenCalledWith(setStateError);
    expect(prScannerProbe.failedToPersistScanCompletedAt).not.toHaveBeenCalled();
  });

  it('sets lastScanStartedAt but not lastScanCompletedAt when scan fails', async () => {
    const scanError = new Error('GitHub API unreachable');
    github.listOpenPRs.mockRejectedValue(scanError);

    const scanner = createScanner();
    await scanner.scan();

    expect(systemState.setLastScanStartedAt).toHaveBeenCalledWith(expect.any(Date));
    expect(systemState.setLastScanCompletedAt).not.toHaveBeenCalledWith(expect.any(Date));
    expect(prScannerProbe.failed).toHaveBeenCalledWith(scanError);
  });

  it('handles getState rejection and calls probe.failed', async () => {
    const stateError = new Error('DB read failed');
    systemState.getLastScanCompletedAt.mockRejectedValue(stateError);

    const scanner = createScanner();
    const result = await scanner.scan();

    expect(prScannerProbe.failed).toHaveBeenCalledWith(stateError);
    expect(result).toStrictEqual({ opened: 0, updated: 0, scannedPRs: [] });
  });

  it('handles empty results: no PRs to upsert and no closures to detect', async () => {
    github.listOpenPRs.mockResolvedValue([]);
    pullRequests.findByPrState.mockResolvedValue([]);

    const scanner = createScanner();
    await scanner.scan();

    expect(pullRequests.upsert).not.toHaveBeenCalled();
    expect(prScannerProbe.discovered).toHaveBeenCalledWith(0, 0);
    expect(prScannerProbe.completed).toHaveBeenCalledWith(0, 0, 0);
  });
});
