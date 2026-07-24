import { PullRequestRepositoryImpl } from '../../src/db/index.js';
import { PrState } from '../../src/domain.js';
import { createMockPrismaClient, createResolvedMock, generatePullRequestHydrationData } from '../helpers/index.js';

import { getUniqueDate, getUniqueGitHubRepoRef, getUniqueInt, getUniqueString } from '@couimet/dynamic-testing';
import { createMockLogger } from '@couimet/logger-contract-testing';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { Prisma } from '@prisma/client';

describe('PullRequestRepositoryImpl', () => {
  let frozenNow: Date;
  let logger: ReturnType<typeof createMockLogger>;
  let repoFullName: string;
  let prNumber: number;

  beforeEach(() => {
    frozenNow = getUniqueDate();
    logger = createMockLogger();
    jest.useFakeTimers();
    jest.setSystemTime(frozenNow);
    repoFullName = getUniqueGitHubRepoRef().fullName;
    prNumber = getUniqueInt();
  });

  describe('upsert', () => {
    it('creates a new pull_request when it does not exist', async () => {
      const row = generatePullRequestHydrationData({
        repo_full_name: repoFullName,
        pr_number: prNumber,
        title: 'Test PR title',
        author_login: 'test-author',
      });

      const { prisma } = createMockPrismaClient({
        pullRequest: { findUnique: createResolvedMock(null), create: createResolvedMock(row) },
      });
      const sut = new PullRequestRepositoryImpl(prisma, logger);

      const result = await sut.upsert(repoFullName, prNumber, { prTitle: 'Test PR', prState: PrState.open });

      expect(result).toStrictEqual({ id: row.id, created: true });
      expect(logger.debug).toHaveBeenCalledWith(
        { fn: 'PullRequestRepositoryImpl.upsert', repoFullName: repoFullName, prNumber: prNumber, id: row.id },
        'Created PullRequest',
      );
    });

    it('creates a new pull_request with fallback title and author when not provided', async () => {
      const row = generatePullRequestHydrationData({
        repo_full_name: repoFullName,
        pr_number: prNumber,
        title: '<unknown>',
        author_login: '<unknown>',
      });

      const { prisma } = createMockPrismaClient({
        pullRequest: { findUnique: createResolvedMock(null), create: createResolvedMock(row) },
      });
      const sut = new PullRequestRepositoryImpl(prisma, logger);

      const result = await sut.upsert(repoFullName, prNumber, { prState: PrState.open });

      expect(result).toStrictEqual({ id: row.id, created: true });
    });

    it('returns existing pull_request when it already exists', async () => {
      const existing = { id: getUniqueInt() };

      const { prisma, pullRequest } = createMockPrismaClient({
        pullRequest: { findUnique: createResolvedMock(existing) },
      });
      const sut = new PullRequestRepositoryImpl(prisma, logger);

      const result = await sut.upsert(repoFullName, prNumber, { prState: PrState.open });

      expect(pullRequest.findUnique).toHaveBeenCalled();
      expect(pullRequest.create).not.toHaveBeenCalled();
      expect(pullRequest.update).toHaveBeenCalledWith({
        where: { id: existing.id },
        data: { pr_state: 'open' },
      });
      expect(result).toStrictEqual({ id: existing.id, created: false });
      expect(logger.debug).toHaveBeenCalledWith(
        { fn: 'PullRequestRepositoryImpl.upsert', repoFullName: repoFullName, prNumber: prNumber, id: existing.id },
        'PullRequest already exists',
      );
    });

    it('updates title on existing PR when prTitle is provided', async () => {
      const prTitle = 'Updated PR title';
      const existing = { id: getUniqueInt() };

      const { prisma, pullRequest } = createMockPrismaClient({
        pullRequest: { findUnique: createResolvedMock(existing) },
      });
      const sut = new PullRequestRepositoryImpl(prisma, logger);

      await sut.upsert(repoFullName, prNumber, { prTitle, prState: PrState.open });

      expect(pullRequest.update).toHaveBeenCalledWith({
        where: { id: existing.id },
        data: { title: prTitle, pr_state: 'open' },
      });
    });

    it('wraps P2025 errors in PrismaRecordNotFoundError', async () => {
      const existing = { id: getUniqueInt() };
      const p2025 = new Prisma.PrismaClientKnownRequestError('Record not found', { code: 'P2025', clientVersion: '7.8.0' });
      const { prisma, pullRequest: _pullRequest } = createMockPrismaClient({
        pullRequest: { findUnique: jest.fn<any>().mockResolvedValue(existing), update: jest.fn<any>().mockRejectedValue(p2025) },
      });
      const sut = new PullRequestRepositoryImpl(prisma, logger);

      await expect(sut.upsert(repoFullName, prNumber, { prTitle: 'Test', prState: PrState.open })).rejects.toBeDetailedError('PRISMA_RECORD_NOT_FOUND_P2025', {
        message: "Record not found in table 'PullRequest'",
        functionName: 'PullRequestRepositoryImpl.upsert',
        details: { tableName: 'PullRequest' },
        cause: p2025,
      });
      expect(logger.debug).toHaveBeenCalledWith(
        { fn: 'PullRequestRepositoryImpl.upsert', modelName: 'PullRequest', prismaCode: 'P2025' },
        'Prisma record not found, throwing typed error',
      );
    });

    it('creates with prState on create', async () => {
      const row = { id: getUniqueInt() };
      const mockCreate = jest.fn<any>().mockResolvedValue(row);

      const { prisma } = createMockPrismaClient({
        pullRequest: { findUnique: createResolvedMock(null), create: mockCreate },
      });
      const sut = new PullRequestRepositoryImpl(prisma, logger);

      await sut.upsert(repoFullName, prNumber, { prState: PrState.closed });

      expect(mockCreate).toHaveBeenCalledWith({
        data: {
          repo_full_name: repoFullName,
          pr_number: prNumber,
          title: '<unknown>',
          author_login: '<unknown>',
          pr_state: 'closed',
          first_seen_at: frozenNow,
        },
      });
      expect(logger.debug).toHaveBeenCalledWith(
        { fn: 'PullRequestRepositoryImpl.upsert', repoFullName: repoFullName, prNumber: prNumber, id: row.id },
        'Created PullRequest',
      );
    });

    it('creates with authorLogin on create', async () => {
      const row = { id: getUniqueInt() };
      const authorLogin = getUniqueString();
      const mockCreate = jest.fn<any>().mockResolvedValue(row);

      const { prisma } = createMockPrismaClient({
        pullRequest: { findUnique: createResolvedMock(null), create: mockCreate },
      });
      const sut = new PullRequestRepositoryImpl(prisma, logger);

      await sut.upsert(repoFullName, prNumber, { prState: PrState.open, authorLogin });

      expect(mockCreate).toHaveBeenCalledWith({
        data: {
          repo_full_name: repoFullName,
          pr_number: prNumber,
          title: '<unknown>',
          author_login: authorLogin,
          pr_state: 'open',
          first_seen_at: frozenNow,
        },
      });
      expect(logger.debug).toHaveBeenCalledWith(
        { fn: 'PullRequestRepositoryImpl.upsert', repoFullName: repoFullName, prNumber: prNumber, id: row.id },
        'Created PullRequest',
      );
    });

    it('updates prState on existing PR', async () => {
      const existing = { id: getUniqueInt() };
      const { prisma, pullRequest } = createMockPrismaClient({
        pullRequest: { findUnique: createResolvedMock(existing) },
      });
      const sut = new PullRequestRepositoryImpl(prisma, logger);

      await sut.upsert(repoFullName, prNumber, { prState: PrState.merged });

      expect(pullRequest.update).toHaveBeenCalledWith({
        where: { id: existing.id },
        data: { pr_state: 'merged' },
      });
      expect(logger.debug).toHaveBeenCalledWith(
        { fn: 'PullRequestRepositoryImpl.upsert', repoFullName: repoFullName, prNumber: prNumber, id: existing.id },
        'PullRequest already exists',
      );
    });

    it('updates authorLogin on existing PR', async () => {
      const authorLogin = getUniqueString();
      const existing = { id: getUniqueInt() };
      const { prisma, pullRequest } = createMockPrismaClient({
        pullRequest: { findUnique: createResolvedMock(existing) },
      });
      const sut = new PullRequestRepositoryImpl(prisma, logger);

      await sut.upsert(repoFullName, prNumber, { prState: PrState.open, authorLogin });

      expect(pullRequest.update).toHaveBeenCalledWith({
        where: { id: existing.id },
        data: { pr_state: 'open', author_login: authorLogin },
      });
      expect(logger.debug).toHaveBeenCalledWith(
        { fn: 'PullRequestRepositoryImpl.upsert', repoFullName: repoFullName, prNumber: prNumber, id: existing.id },
        'PullRequest already exists',
      );
    });
  });

  describe('findByRepoAndPr', () => {
    it('returns the PR id when found', async () => {
      const row = { id: getUniqueInt() };
      const { prisma } = createMockPrismaClient({
        pullRequest: { findUnique: createResolvedMock(row) },
      });
      const sut = new PullRequestRepositoryImpl(prisma, logger);

      const result = await sut.findByRepoAndPr(repoFullName, prNumber);

      expect(result).toStrictEqual({ id: row.id });
    });

    it('returns null when not found', async () => {
      const { prisma } = createMockPrismaClient({
        pullRequest: { findUnique: createResolvedMock(null) },
      });
      const sut = new PullRequestRepositoryImpl(prisma, logger);

      const result = await sut.findByRepoAndPr(repoFullName, prNumber);

      expect(result).toBeNull();
    });
  });

  describe('updateTitle', () => {
    it('updates the title on the pull_request row', async () => {
      const id = getUniqueInt();
      const title = 'Updated PR title';
      const { prisma, pullRequest } = createMockPrismaClient();
      const sut = new PullRequestRepositoryImpl(prisma, logger);

      await sut.updateTitle(id, title, prisma);

      expect(pullRequest.update).toHaveBeenCalledWith({ where: { id }, data: { title } });
      expect(logger.debug).toHaveBeenCalledWith({ fn: 'PullRequestRepositoryImpl.updateTitle', id }, 'Updated PullRequest title');
    });

    it('wraps P2025 errors in PrismaRecordNotFoundError', async () => {
      const p2025 = new Prisma.PrismaClientKnownRequestError('Record not found', { code: 'P2025', clientVersion: '7.8.0' });
      const { prisma, pullRequest: _pullRequest } = createMockPrismaClient({
        pullRequest: { update: jest.fn<any>().mockRejectedValue(p2025) },
      });
      const sut = new PullRequestRepositoryImpl(prisma, logger);

      await expect(sut.updateTitle(getUniqueInt(), 'title', prisma)).rejects.toBeDetailedError('PRISMA_RECORD_NOT_FOUND_P2025', {
        message: "Record not found in table 'PullRequest'",
        functionName: 'PullRequestRepositoryImpl.updateTitle',
        details: { tableName: 'PullRequest' },
        cause: p2025,
      });
      expect(logger.debug).toHaveBeenCalledWith(
        { fn: 'PullRequestRepositoryImpl.updateTitle', modelName: 'PullRequest', prismaCode: 'P2025' },
        'Prisma record not found, throwing typed error',
      );
    });
  });

  describe('incrementRetriggerCount', () => {
    it('increments retrigger_count and sets last_review_requested_at', async () => {
      const id = getUniqueInt();
      const { prisma, pullRequest } = createMockPrismaClient();
      const sut = new PullRequestRepositoryImpl(prisma, logger);

      await sut.incrementRetriggerCount(id, prisma);

      expect(pullRequest.update).toHaveBeenCalledWith({
        where: { id },
        data: {
          retrigger_count: { increment: 1 },
          last_review_requested_at: frozenNow,
        },
      });
      expect(logger.debug).toHaveBeenCalledWith({ fn: 'PullRequestRepositoryImpl.incrementRetriggerCount', id }, 'Incremented retrigger count on PullRequest');
    });

    it('wraps P2025 errors in PrismaRecordNotFoundError', async () => {
      const p2025 = new Prisma.PrismaClientKnownRequestError('Record not found', { code: 'P2025', clientVersion: '7.8.0' });
      const { prisma, pullRequest: _pullRequest } = createMockPrismaClient({
        pullRequest: { update: jest.fn<any>().mockRejectedValue(p2025) },
      });
      const sut = new PullRequestRepositoryImpl(prisma, logger);

      await expect(sut.incrementRetriggerCount(getUniqueInt(), prisma)).rejects.toBeDetailedError('PRISMA_RECORD_NOT_FOUND_P2025', {
        message: "Record not found in table 'PullRequest'",
        functionName: 'PullRequestRepositoryImpl.incrementRetriggerCount',
        details: { tableName: 'PullRequest' },
        cause: p2025,
      });
      expect(logger.debug).toHaveBeenCalledWith(
        { fn: 'PullRequestRepositoryImpl.incrementRetriggerCount', modelName: 'PullRequest', prismaCode: 'P2025' },
        'Prisma record not found, throwing typed error',
      );
    });
  });

  describe('findPendingAcknowledgement', () => {
    it('returns the mapped PR when a pending acknowledgement exists', async () => {
      const lastReviewRequestedAt = getUniqueDate();
      const pr = {
        id: getUniqueInt(),
        repo_full_name: getUniqueGitHubRepoRef().fullName,
        pr_number: getUniqueInt(),
        last_review_requested_at: lastReviewRequestedAt.toISOString(),
      };
      const queryRawUnsafe = jest.fn<any>().mockResolvedValue([pr]);
      const { prisma } = createMockPrismaClient({ $queryRawUnsafe: queryRawUnsafe });
      const sut = new PullRequestRepositoryImpl(prisma, logger);
      const result = await sut.findPendingAcknowledgement();
      expect(queryRawUnsafe).toHaveBeenCalledWith(
        expect.toEqualIgnoringWhitespace(
          'SELECT id, repo_full_name, pr_number, last_review_requested_at FROM pull_request WHERE last_review_requested_at IS NOT NULL AND (last_coderabbit_acknowledged_at IS NULL OR last_coderabbit_acknowledged_at < last_review_requested_at) ORDER BY last_review_requested_at ASC LIMIT 1',
        ),
      );
      expect(result).toStrictEqual({
        id: pr.id,
        repo_full_name: pr.repo_full_name,
        pr_number: pr.pr_number,
        last_review_requested_at: lastReviewRequestedAt,
      });
    });

    it('returns undefined when no PRs have a pending acknowledgement', async () => {
      const { prisma } = createMockPrismaClient({ $queryRawUnsafe: jest.fn<any>().mockResolvedValue([]) });
      const sut = new PullRequestRepositoryImpl(prisma, logger);
      const result = await sut.findPendingAcknowledgement();
      expect(result).toBeUndefined();
    });
  });

  describe('recordAcknowledgement', () => {
    it('sets last_coderabbit_acknowledged_at on the pull_request row', async () => {
      const id = getUniqueInt();
      const { prisma, pullRequest: _pullRequest } = createMockPrismaClient();
      const sut = new PullRequestRepositoryImpl(prisma, logger);
      await sut.recordAcknowledgement(id);
      expect(_pullRequest.update).toHaveBeenCalledWith({ where: { id }, data: { last_coderabbit_acknowledged_at: frozenNow } });
      expect(logger.debug).toHaveBeenCalledWith(
        { fn: 'PullRequestRepositoryImpl.recordAcknowledgement', id },
        'Recorded CodeRabbit acknowledgement on PullRequest',
      );
    });
  });

  describe('recordReview', () => {
    it('increments review_count and sets last_coderabbit_review_at', async () => {
      const id = getUniqueInt();
      const { prisma, pullRequest } = createMockPrismaClient();
      const sut = new PullRequestRepositoryImpl(prisma, logger);

      await sut.recordReview(id, prisma);

      expect(pullRequest.update).toHaveBeenCalledWith({
        where: { id },
        data: {
          review_count: { increment: 1 },
          last_coderabbit_review_at: frozenNow,
        },
      });
      expect(logger.debug).toHaveBeenCalledWith({ fn: 'PullRequestRepositoryImpl.recordReview', id }, 'Recorded review on PullRequest');
    });

    it('wraps P2025 errors in PrismaRecordNotFoundError', async () => {
      const p2025 = new Prisma.PrismaClientKnownRequestError('Record not found', { code: 'P2025', clientVersion: '7.8.0' });
      const { prisma, pullRequest: _pullRequest } = createMockPrismaClient({
        pullRequest: { update: jest.fn<any>().mockRejectedValue(p2025) },
      });
      const sut = new PullRequestRepositoryImpl(prisma, logger);

      await expect(sut.recordReview(getUniqueInt(), prisma)).rejects.toBeDetailedError('PRISMA_RECORD_NOT_FOUND_P2025', {
        message: "Record not found in table 'PullRequest'",
        functionName: 'PullRequestRepositoryImpl.recordReview',
        details: { tableName: 'PullRequest' },
        cause: p2025,
      });
      expect(logger.debug).toHaveBeenCalledWith(
        { fn: 'PullRequestRepositoryImpl.recordReview', modelName: 'PullRequest', prismaCode: 'P2025' },
        'Prisma record not found, throwing typed error',
      );
    });
  });

  describe('findByPrState', () => {
    it('returns matching PRs when found', async () => {
      const rows = [
        { id: getUniqueInt(), repo_full_name: repoFullName, pr_number: prNumber },
        { id: getUniqueInt(), repo_full_name: getUniqueGitHubRepoRef().fullName, pr_number: getUniqueInt() },
      ];
      const { prisma } = createMockPrismaClient({
        pullRequest: { findMany: createResolvedMock(rows) },
      });
      const sut = new PullRequestRepositoryImpl(prisma, logger);

      const result = await sut.findByPrState(PrState.open);

      expect(result).toStrictEqual(rows);
    });

    it('returns empty array when none match', async () => {
      const { prisma } = createMockPrismaClient({
        pullRequest: { findMany: createResolvedMock([]) },
      });
      const sut = new PullRequestRepositoryImpl(prisma, logger);

      const result = await sut.findByPrState(PrState.merged);

      expect(result).toStrictEqual([]);
    });
  });

  describe('getColumnMaps', () => {
    it('returns empty result when ids array is empty', async () => {
      const { prisma } = createMockPrismaClient();
      const sut = new PullRequestRepositoryImpl(prisma, logger);

      const result = await sut.getColumnMaps([], ['pr_state']);

      expect(result).toStrictEqual({ pr_state: new Map() });
    });

    it('returns empty result when columns array is empty', async () => {
      const { prisma } = createMockPrismaClient();
      const sut = new PullRequestRepositoryImpl(prisma, logger);

      const result = await sut.getColumnMaps([1], []);

      expect(result).toStrictEqual({});
    });

    it('returns a map per column populated from the database rows', async () => {
      const id1 = getUniqueInt();
      const id2 = getUniqueInt();
      const rows = [
        { id: id1, pr_state: 'open' },
        { id: id2, pr_state: 'merged' },
      ];
      const { prisma } = createMockPrismaClient({
        pullRequest: { findMany: createResolvedMock(rows) },
      });
      const sut = new PullRequestRepositoryImpl(prisma, logger);

      const result = await sut.getColumnMaps([id1, id2], ['pr_state']);

      expect(prisma.pullRequest.findMany).toHaveBeenCalledWith({
        where: { id: { in: [id1, id2] } },
        select: { id: true, pr_state: true },
      });
      expect(result).toStrictEqual({
        pr_state: new Map([
          [id1, 'open'],
          [id2, 'merged'],
        ]),
      });
    });

    it('handles multiple ids and multiple columns', async () => {
      const id1 = getUniqueInt();
      const id2 = getUniqueInt();
      const acknowledgedAt = getUniqueDate();
      const rows = [
        { id: id1, pr_state: 'open', last_coderabbit_acknowledged_at: acknowledgedAt },
        { id: id2, pr_state: 'merged', last_coderabbit_acknowledged_at: null },
      ];
      const { prisma } = createMockPrismaClient({
        pullRequest: { findMany: createResolvedMock(rows) },
      });
      const sut = new PullRequestRepositoryImpl(prisma, logger);

      const result = await sut.getColumnMaps([id1, id2], ['pr_state', 'last_coderabbit_acknowledged_at']);

      expect(prisma.pullRequest.findMany).toHaveBeenCalledWith({
        where: { id: { in: [id1, id2] } },
        select: { id: true, pr_state: true, last_coderabbit_acknowledged_at: true },
      });
      expect(result).toStrictEqual({
        pr_state: new Map([
          [id1, 'open'],
          [id2, 'merged'],
        ]),
        last_coderabbit_acknowledged_at: new Map([
          [id1, acknowledgedAt],
          [id2, null],
        ]),
      });
    });
  });

  describe('findStaleOpenPRs', () => {
    it('returns stale open PRs with last_review_requested_at as Date objects', async () => {
      const lastReviewRequestedAt = getUniqueDate();
      const rows = [
        {
          id: getUniqueInt(),
          repo_full_name: getUniqueGitHubRepoRef().fullName,
          pr_number: getUniqueInt(),
          title: getUniqueString(),
          last_review_requested_at: lastReviewRequestedAt.toISOString(),
        },
        {
          id: getUniqueInt(),
          repo_full_name: getUniqueGitHubRepoRef().fullName,
          pr_number: getUniqueInt(),
          title: getUniqueString(),
          last_review_requested_at: lastReviewRequestedAt.toISOString(),
        },
      ];
      const queryRawUnsafe = jest.fn<any>().mockResolvedValue(rows);
      const { prisma } = createMockPrismaClient({ $queryRawUnsafe: queryRawUnsafe });
      const sut = new PullRequestRepositoryImpl(prisma, logger);

      const result = await sut.findStaleOpenPRs();

      expect(queryRawUnsafe).toHaveBeenCalledWith(
        expect.toEqualIgnoringWhitespace(
          "SELECT pr.id, pr.repo_full_name, pr.pr_number, pr.title, pr.last_review_requested_at FROM pull_request pr WHERE pr.pr_state = 'open' AND pr.last_review_requested_at IS NOT NULL AND (pr.last_coderabbit_review_at IS NULL OR pr.last_coderabbit_review_at < pr.last_review_requested_at) AND NOT EXISTS (SELECT 1 FROM review_queue rq WHERE rq.pull_request_id = pr.id AND rq.status IN ('pending', 'retriggered'))",
        ),
      );
      expect(result).toStrictEqual(
        rows.map((row) => ({
          id: row.id,
          repoFullName: row.repo_full_name,
          prNumber: row.pr_number,
          title: row.title,
          lastReviewRequestedAt: new Date(row.last_review_requested_at),
        })),
      );
      expect(logger.debug).toHaveBeenCalledWith({ fn: 'PullRequestRepositoryImpl.findStaleOpenPRs', count: rows.length }, 'Found stale open PRs');
    });

    it('returns empty array when no stale PRs exist', async () => {
      const { prisma } = createMockPrismaClient({ $queryRawUnsafe: jest.fn<any>().mockResolvedValue([]) });
      const sut = new PullRequestRepositoryImpl(prisma, logger);

      const result = await sut.findStaleOpenPRs();

      expect(result).toStrictEqual([]);
      expect(logger.debug).toHaveBeenCalledWith({ fn: 'PullRequestRepositoryImpl.findStaleOpenPRs', count: 0 }, 'Found stale open PRs');
    });
  });

  describe('recordReviewLimitDetection', () => {
    it('sets both timestamps when first is null', async () => {
      const id = getUniqueInt();
      const reviewLimitAt = getUniqueDate();
      const existing = { id, first_review_limit_at: null };
      const { prisma, pullRequest } = createMockPrismaClient({
        pullRequest: { findUnique: createResolvedMock(existing) },
      });
      const sut = new PullRequestRepositoryImpl(prisma, logger);

      await sut.recordReviewLimitDetection(id, reviewLimitAt, prisma);

      expect(pullRequest.update).toHaveBeenCalledWith({
        where: { id },
        data: { first_review_limit_at: reviewLimitAt, last_review_limit_at: reviewLimitAt },
      });
      expect(logger.debug).toHaveBeenCalledWith(
        { fn: 'PullRequestRepositoryImpl.recordReviewLimitDetection', id },
        'Recorded review limit detection on PullRequest',
      );
    });

    it('sets only last when first exists', async () => {
      const id = getUniqueInt();
      const reviewLimitAt = getUniqueDate();
      const existing = { id, first_review_limit_at: new Date() };
      const { prisma, pullRequest } = createMockPrismaClient({
        pullRequest: { findUnique: createResolvedMock(existing) },
      });
      const sut = new PullRequestRepositoryImpl(prisma, logger);

      await sut.recordReviewLimitDetection(id, reviewLimitAt, prisma);

      expect(pullRequest.update).toHaveBeenCalledWith({
        where: { id },
        data: { last_review_limit_at: reviewLimitAt },
      });
      expect(logger.debug).toHaveBeenCalledWith(
        { fn: 'PullRequestRepositoryImpl.recordReviewLimitDetection', id },
        'Recorded review limit detection on PullRequest',
      );
    });
  });
});
