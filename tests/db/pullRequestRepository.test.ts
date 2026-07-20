import { PullRequestRepositoryImpl } from '../../src/db/pullRequestRepository.js';
import { CodeRabbitCommentType } from '../../src/types/CodeRabbitCommentType.js';
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
      const reviewLimitAt = new Date();

      const { prisma } = createMockPrismaClient({
        pullRequest: { findUnique: createResolvedMock(null), create: createResolvedMock(row) },
      });
      const sut = new PullRequestRepositoryImpl(prisma, logger);

      const result = await sut.upsert(repoFullName, prNumber, { prTitle: 'Test PR', reviewLimitAt }, prisma);

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

      const result = await sut.upsert(repoFullName, prNumber, {}, prisma);

      expect(result).toStrictEqual({ id: row.id, created: true });
    });

    it('returns existing pull_request when it already exists', async () => {
      const existing = { id: getUniqueInt() };

      const { prisma, pullRequest } = createMockPrismaClient({
        pullRequest: { findUnique: createResolvedMock(existing) },
      });
      const sut = new PullRequestRepositoryImpl(prisma, logger);

      const result = await sut.upsert(repoFullName, prNumber, {}, prisma);

      expect(pullRequest.findUnique).toHaveBeenCalled();
      expect(pullRequest.create).not.toHaveBeenCalled();
      expect(pullRequest.update).not.toHaveBeenCalled();
      expect(result).toStrictEqual({ id: existing.id, created: false });
      expect(logger.debug).toHaveBeenCalledWith(
        { fn: 'PullRequestRepositoryImpl.upsert', repoFullName: repoFullName, prNumber: prNumber, id: existing.id },
        'PullRequest already exists',
      );
    });

    it('updates reviewLimitAt on existing PR', async () => {
      const reviewLimitAt = new Date();
      const existing = { id: getUniqueInt() };

      const { prisma, pullRequest } = createMockPrismaClient({
        pullRequest: { findUnique: createResolvedMock(existing) },
      });
      const sut = new PullRequestRepositoryImpl(prisma, logger);

      await sut.upsert(repoFullName, prNumber, { reviewLimitAt }, prisma);

      expect(pullRequest.update).toHaveBeenCalledWith({
        where: { id: existing.id },
        data: { last_review_limit_at: reviewLimitAt },
      });
    });

    it('sets first_review_limit_at on existing PR when it was previously null', async () => {
      const reviewLimitAt = new Date();
      const existing = { id: getUniqueInt(), first_review_limit_at: null };

      const { prisma, pullRequest } = createMockPrismaClient({
        pullRequest: { findUnique: createResolvedMock(existing) },
      });
      const sut = new PullRequestRepositoryImpl(prisma, logger);

      await sut.upsert(repoFullName, prNumber, { reviewLimitAt }, prisma);

      expect(pullRequest.update).toHaveBeenCalledWith({
        where: { id: existing.id },
        data: { first_review_limit_at: reviewLimitAt, last_review_limit_at: reviewLimitAt },
      });
    });

    it('updates title on existing PR when prTitle is provided', async () => {
      const prTitle = 'Updated PR title';
      const existing = { id: getUniqueInt() };

      const { prisma, pullRequest } = createMockPrismaClient({
        pullRequest: { findUnique: createResolvedMock(existing) },
      });
      const sut = new PullRequestRepositoryImpl(prisma, logger);

      await sut.upsert(repoFullName, prNumber, { prTitle }, prisma);

      expect(pullRequest.update).toHaveBeenCalledWith({
        where: { id: existing.id },
        data: { title: prTitle },
      });
    });

    it('wraps P2025 errors in PrismaRecordNotFoundError', async () => {
      const existing = { id: getUniqueInt() };
      const p2025 = new Prisma.PrismaClientKnownRequestError('Record not found', { code: 'P2025', clientVersion: '7.8.0' });
      const { prisma, pullRequest: _pullRequest } = createMockPrismaClient({
        pullRequest: { findUnique: jest.fn<any>().mockResolvedValue(existing), update: jest.fn<any>().mockRejectedValue(p2025) },
      });
      const sut = new PullRequestRepositoryImpl(prisma, logger);

      await expect(sut.upsert(repoFullName, prNumber, { prTitle: 'Test' }, prisma)).rejects.toBeDetailedError('PRISMA_RECORD_NOT_FOUND_P2025', {
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

  describe('updateLastCoderabbitReviewResult', () => {
    it('updates last_review_url, last_review_state, and last_coderabbit_review_at', async () => {
      const id = getUniqueInt();
      const reviewUrl = getUniqueString({ prefix: 'https://gh/pull/1#' });
      const reviewState = CodeRabbitCommentType.review_approved;
      const { prisma, pullRequest } = createMockPrismaClient();
      const sut = new PullRequestRepositoryImpl(prisma, logger);
      const tx = prisma;

      await sut.updateLastCoderabbitReviewResult(id, reviewUrl, reviewState, tx);

      expect(pullRequest.update).toHaveBeenCalledWith({
        where: { id },
        data: { last_review_url: reviewUrl, last_review_state: reviewState, last_coderabbit_review_at: expect.any(Date) as Date },
      });
      expect(logger.debug).toHaveBeenCalledWith(
        { fn: 'PullRequestRepositoryImpl.updateLastCoderabbitReviewResult', id, reviewUrl, reviewState },
        'Updated PullRequest last CodeRabbit review',
      );
    });
  });
});
