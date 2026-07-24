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
  type MockPrScannerProbe,
} from './helpers/index.js';

import { getUniqueGitHubRepoRef, getUniqueInt } from '@couimet/dynamic-testing';
import type { Logger } from '@couimet/logger-contract';
import { createMockLogger } from '@couimet/logger-contract-testing';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const INTERVAL_SEC = 300;

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
    const repoRef1 = getUniqueGitHubRepoRef();
    const prNum1 = getUniqueInt();
    const repoRef2 = getUniqueGitHubRepoRef();
    const prNum2 = getUniqueInt();
    const { prTitle1, authorLogin1, prTitle2, authorLogin2 } = getUniqueStringsNamed(['prTitle1', 'authorLogin1', 'prTitle2', 'authorLogin2']);

    const pr1: DiscoveredPR = { repoFullName: repoRef1.fullName, prNumber: prNum1, prTitle: prTitle1, authorLogin: authorLogin1 };
    const pr2: DiscoveredPR = { repoFullName: repoRef2.fullName, prNumber: prNum2, prTitle: prTitle2, authorLogin: authorLogin2 };

    github.listOpenPRs.mockResolvedValue([pr1, pr2]);
    pullRequests.upsert.mockResolvedValueOnce({ id: 1, created: true }).mockResolvedValueOnce({ id: 2, created: false });
    pullRequests.findByPrState.mockResolvedValue([]);

    const scanner = createScanner();
    await scanner.scan();

    expect(pullRequests.upsert).toHaveBeenCalledWith(repoRef1.fullName, prNum1, { prTitle: prTitle1, prState: 'open', authorLogin: authorLogin1 });
    expect(pullRequests.upsert).toHaveBeenCalledWith(repoRef2.fullName, prNum2, { prTitle: prTitle2, prState: 'open', authorLogin: authorLogin2 });
    expect(prScannerProbe.scanStarted).toHaveBeenCalled();
    expect(prScannerProbe.discovered).toHaveBeenCalledWith(1, 1);
    expect(prScannerProbe.completed).toHaveBeenCalledWith(1, 1, 0);
  });

  it('detects closures: updates DB PRs not in GitHub open list with correct prState', async () => {
    const repoOpen = getUniqueGitHubRepoRef();
    const prOpen = getUniqueInt();
    const repoMerged = getUniqueGitHubRepoRef();
    const prMerged = getUniqueInt();
    const repoClosed = getUniqueGitHubRepoRef();
    const prClosed = getUniqueInt();
    const { prTitle, authorLogin } = getUniqueStringsNamed(['prTitle', 'authorLogin']);

    const discoveredPR: DiscoveredPR = { repoFullName: repoOpen.fullName, prNumber: prOpen, prTitle, authorLogin };
    const dbOpenPRs = [
      { id: getUniqueInt(), repo_full_name: repoOpen.fullName, pr_number: prOpen },
      { id: getUniqueInt(), repo_full_name: repoMerged.fullName, pr_number: prMerged },
      { id: getUniqueInt(), repo_full_name: repoClosed.fullName, pr_number: prClosed },
    ];

    github.listOpenPRs.mockResolvedValue([discoveredPR]);
    pullRequests.findByPrState.mockResolvedValue(dbOpenPRs);
    github.getPRState.mockResolvedValueOnce({ state: 'closed', merged_at: '2024-01-01T00:00:00Z' }).mockResolvedValueOnce({ state: 'closed', merged_at: null });

    const scanner = createScanner();
    await scanner.scan();

    expect(pullRequests.upsert).toHaveBeenCalledWith(repoMerged.fullName, prMerged, { prState: 'merged' });
    expect(pullRequests.upsert).toHaveBeenCalledWith(repoClosed.fullName, prClosed, { prState: 'closed' });
    expect(github.getPRState).toHaveBeenCalledTimes(2);
    expect(prScannerProbe.detectedClosures).toHaveBeenCalledWith(2);
    expect(prScannerProbe.completed).toHaveBeenCalledWith(1, 0, 2);
  });

  it('respects interval gate: skips via probe when last scan is within interval', async () => {
    const intervalMs = INTERVAL_SEC * 1000;
    systemState.getState.mockResolvedValue(new Date());

    const scanner = createScanner();
    await scanner.scan();

    expect(prScannerProbe.scanStarted).toHaveBeenCalledTimes(1);
    expect(prScannerProbe.skipped).toHaveBeenCalledWith(expect.any(Number), intervalMs);
    expect(systemState.setState).not.toHaveBeenCalled();
  });

  it('handles per-PR errors gracefully without stopping the scan', async () => {
    const repoRef1 = getUniqueGitHubRepoRef();
    const prNum1 = getUniqueInt();
    const repoRef2 = getUniqueGitHubRepoRef();
    const prNum2 = getUniqueInt();

    const { prTitle: prTitle1, authorLogin: authorLogin1 } = getUniqueStringsNamed(['prTitle', 'authorLogin']);
    const { prTitle: prTitle2, authorLogin: authorLogin2 } = getUniqueStringsNamed(['prTitle', 'authorLogin']);

    const pr1: DiscoveredPR = { repoFullName: repoRef1.fullName, prNumber: prNum1, prTitle: prTitle1, authorLogin: authorLogin1 };
    const pr2: DiscoveredPR = { repoFullName: repoRef2.fullName, prNumber: prNum2, prTitle: prTitle2, authorLogin: authorLogin2 };

    github.listOpenPRs.mockResolvedValue([pr1, pr2]);
    const dbError = new Error('DB connection failed');
    pullRequests.upsert.mockRejectedValueOnce(dbError).mockResolvedValueOnce({ id: 2, created: false });
    pullRequests.findByPrState.mockResolvedValue([]);

    const scanner = createScanner();
    await scanner.scan();

    expect(pullRequests.upsert).toHaveBeenCalledTimes(2);
    expect(prScannerProbe.caughtError).toHaveBeenCalledWith(repoRef1.fullName, prNum1, dbError);
    expect(prScannerProbe.discovered).toHaveBeenCalledWith(0, 1);
    expect(prScannerProbe.completed).toHaveBeenCalledWith(0, 1, 0);
  });

  it('handles per-PR errors in closure detection without stopping the scan', async () => {
    const repoOpen = getUniqueGitHubRepoRef();
    const prOpen = getUniqueInt();
    const repoFail = getUniqueGitHubRepoRef();
    const prFail = getUniqueInt();

    const { prTitle, authorLogin } = getUniqueStringsNamed(['prTitle', 'authorLogin']);
    const discoveredPR: DiscoveredPR = { repoFullName: repoOpen.fullName, prNumber: prOpen, prTitle, authorLogin };
    const dbOpenPRs = [
      { id: getUniqueInt(), repo_full_name: repoOpen.fullName, pr_number: prOpen },
      { id: getUniqueInt(), repo_full_name: repoFail.fullName, pr_number: prFail },
    ];

    github.listOpenPRs.mockResolvedValue([discoveredPR]);
    pullRequests.findByPrState.mockResolvedValue(dbOpenPRs);
    const apiError = new Error('GitHub API error');
    github.getPRState.mockRejectedValueOnce(apiError);

    const scanner = createScanner();
    await scanner.scan();

    expect(prScannerProbe.caughtError).toHaveBeenCalledWith(repoFail.fullName, prFail, apiError);
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
    systemState.setState.mockRejectedValue(setStateError);
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
    systemState.setState.mockRejectedValue(setStateError);

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

    expect(systemState.setState).toHaveBeenCalledWith('last_scan_started_at', expect.any(Date));
    expect(systemState.setState).not.toHaveBeenCalledWith('last_scan_completed_at', expect.any(Date));
    expect(prScannerProbe.failed).toHaveBeenCalledWith(scanError);
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
