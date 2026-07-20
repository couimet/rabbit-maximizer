import { PullRequestRepositoryImpl } from '../../src/db/pullRequestRepository.js';
import { createMockPrismaClient, createResolvedMock } from '../helpers/index.js';

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
      const row = {
        id: getUniqueInt(),
        uuid: getUniqueString(),
        repo_full_name: repoFullName,
        pr_number: prNumber,
        title: 'Test PR title',
        author_login: 'test-author',
        pr_state: 'open',
        first_seen_at: new Date(),
        first_review_limit_at: null,
        last_review_limit_at: null,
        last_review_requested_at: null,
        last_coderabbit_review_at: null,
        retrigger_count: 0,
        review_count: 0,
        created_at: new Date(),
        updated_at: new Date(),
      };

      const { prisma } = createMockPrismaClient({
        pullRequest: { findUnique: createResolvedMock(null), create: createResolvedMock(row) },
      });
      const sut = new PullRequestRepositoryImpl(prisma, logger);

      const result = await sut.upsert(repoFullName, prNumber, { prTitle: 'Test PR', prState: 'open' });

      expect(result).toStrictEqual({ id: row.id, created: true });
      expect(logger.debug).toHaveBeenCalledWith(
        { fn: 'PullRequestRepositoryImpl.upsert', repoFullName: repoFullName, prNumber: prNumber, id: row.id },
        'Created PullRequest',
      );
    });

    it('creates a new pull_request with fallback title and author when not provided', async () => {
      const row = {
        id: getUniqueInt(),
        uuid: getUniqueString(),
        repo_full_name: repoFullName,
        pr_number: prNumber,
        title: '<unknown>',
        author_login: '<unknown>',
        pr_state: 'open',
        first_seen_at: new Date(),
        first_review_limit_at: null,
        last_review_limit_at: null,
        last_review_requested_at: null,
        last_coderabbit_review_at: null,
        retrigger_count: 0,
        review_count: 0,
        created_at: new Date(),
        updated_at: new Date(),
      };

      const { prisma } = createMockPrismaClient({
        pullRequest: { findUnique: createResolvedMock(null), create: createResolvedMock(row) },
      });
      const sut = new PullRequestRepositoryImpl(prisma, logger);

      const result = await sut.upsert(repoFullName, prNumber, { prState: 'open' });

      expect(result).toStrictEqual({ id: row.id, created: true });
    });

    it('returns existing pull_request when it already exists', async () => {
      const existing = { id: getUniqueInt() };

      const { prisma, pullRequest } = createMockPrismaClient({
        pullRequest: { findUnique: createResolvedMock(existing) },
      });
      const sut = new PullRequestRepositoryImpl(prisma, logger);

      const result = await sut.upsert(repoFullName, prNumber, { prState: 'open' });

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

      await sut.upsert(repoFullName, prNumber, { prTitle, prState: 'open' });

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

      await expect(sut.upsert(repoFullName, prNumber, { prTitle: 'Test', prState: 'open' })).rejects.toBeDetailedError('PRISMA_RECORD_NOT_FOUND_P2025', {
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

      await sut.upsert(repoFullName, prNumber, { prState: 'closed' });

      expect(mockCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({ pr_state: 'closed' }),
      });
    });

    it('creates with authorLogin on create', async () => {
      const row = { id: getUniqueInt() };
      const authorLogin = getUniqueString();
      const mockCreate = jest.fn<any>().mockResolvedValue(row);

      const { prisma } = createMockPrismaClient({
        pullRequest: { findUnique: createResolvedMock(null), create: mockCreate },
      });
      const sut = new PullRequestRepositoryImpl(prisma, logger);

      await sut.upsert(repoFullName, prNumber, { prState: 'open', authorLogin });

      expect(mockCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({ author_login: authorLogin }),
      });
    });

    it('updates prState on existing PR', async () => {
      const existing = { id: getUniqueInt() };
      const { prisma, pullRequest } = createMockPrismaClient({
        pullRequest: { findUnique: createResolvedMock(existing) },
      });
      const sut = new PullRequestRepositoryImpl(prisma, logger);

      await sut.upsert(repoFullName, prNumber, { prState: 'merged' });

      expect(pullRequest.update).toHaveBeenCalledWith({
        where: { id: existing.id },
        data: { pr_state: 'merged' },
      });
    });

    it('updates authorLogin on existing PR', async () => {
      const authorLogin = getUniqueString();
      const existing = { id: getUniqueInt() };
      const { prisma, pullRequest } = createMockPrismaClient({
        pullRequest: { findUnique: createResolvedMock(existing) },
      });
      const sut = new PullRequestRepositoryImpl(prisma, logger);

      await sut.upsert(repoFullName, prNumber, { prState: 'open', authorLogin });

      expect(pullRequest.update).toHaveBeenCalledWith({
        where: { id: existing.id },
        data: { pr_state: 'open', author_login: authorLogin },
      });
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

      const result = await sut.findByPrState('open');

      expect(result).toStrictEqual(rows);
    });

    it('returns empty array when none match', async () => {
      const { prisma } = createMockPrismaClient({
        pullRequest: { findMany: createResolvedMock([]) },
      });
      const sut = new PullRequestRepositoryImpl(prisma, logger);

      const result = await sut.findByPrState('merged');

      expect(result).toStrictEqual([]);
    });
  });

  describe('getPrStateMap', () => {
    it('returns empty map when ids is empty', async () => {
      const { prisma } = createMockPrismaClient();
      const sut = new PullRequestRepositoryImpl(prisma, logger);

      const result = await sut.getPrStateMap([]);

      expect(result).toStrictEqual(new Map());
    });

    it('returns map with pr_state values', async () => {
      const rows = [
        { id: 10, pr_state: 'open' },
        { id: 20, pr_state: 'merged' },
      ];
      const { prisma } = createMockPrismaClient({
        pullRequest: { findMany: createResolvedMock(rows) },
      });
      const sut = new PullRequestRepositoryImpl(prisma, logger);

      const result = await sut.getPrStateMap([10, 20]);

      expect(result).toStrictEqual(
        new Map([
          [10, 'open'],
          [20, 'merged'],
        ]),
      );
    });
  });

  describe('getAcknowledgedAtMap', () => {
    it('returns empty map when ids is empty', async () => {
      const { prisma } = createMockPrismaClient();
      const sut = new PullRequestRepositoryImpl(prisma, logger);

      const result = await sut.getAcknowledgedAtMap([]);

      expect(result).toStrictEqual(new Map());
    });

    it('returns map with acknowledged_at values including null', async () => {
      const acknowledgedAt = new Date();
      const rows = [
        { id: 10, last_coderabbit_acknowledged_at: acknowledgedAt },
        { id: 20, last_coderabbit_acknowledged_at: null },
      ];
      const { prisma } = createMockPrismaClient({
        pullRequest: { findMany: createResolvedMock(rows) },
      });
      const sut = new PullRequestRepositoryImpl(prisma, logger);

      const result = await sut.getAcknowledgedAtMap([10, 20]);

      expect(result).toStrictEqual(
        new Map([
          [10, acknowledgedAt],
          [20, undefined],
        ]),
      );
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
    });
  });
});
