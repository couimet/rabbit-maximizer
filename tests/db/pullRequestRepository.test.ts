import { PullRequestRepositoryImpl } from '../../src/db/index.js';
import { CodeRabbitCommentType, PrState } from '../../src/domain.js';
import { createMockPrismaClient, createResolvedMock, generatePullRequestHydrationData, generateReviewRef } from '../helpers/index.js';

import { getUniqueDate, getUniqueInt, getUniqueString } from '@couimet/dynamic-testing';
import { createMockLogger } from '@couimet/logger-contract-testing';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { Prisma } from '@prisma/client';

describe('PullRequestRepositoryImpl', () => {
  let frozenNow: Date;
  let logger: ReturnType<typeof createMockLogger>;
  let ref: ReturnType<typeof generateReviewRef>;

  beforeEach(() => {
    frozenNow = getUniqueDate();
    logger = createMockLogger();
    jest.useFakeTimers();
    jest.setSystemTime(frozenNow);
    ref = generateReviewRef();
  });

  describe('upsert', () => {
    it('creates a new pull_request when it does not exist', async () => {
      const row = generatePullRequestHydrationData({
        repo_full_name: ref.repoFullName,
        pr_number: ref.prNumber,
        title: 'Test PR title',
        author_login: 'test-author',
      });

      const { prisma } = createMockPrismaClient({
        pullRequest: { findUnique: createResolvedMock(null), create: createResolvedMock(row) },
      });
      const sut = new PullRequestRepositoryImpl(prisma, logger);

      const result = await sut.upsert(ref.repoFullName, ref.prNumber, { prTitle: 'Test PR', prState: PrState.open });

      expect(result).toStrictEqual({ id: row.id, created: true });
      expect(logger.debug).toHaveBeenCalledWith(
        { fn: 'PullRequestRepositoryImpl.upsert', repoFullName: ref.repoFullName, prNumber: ref.prNumber, id: row.id },
        'Created PullRequest',
      );
    });

    it('creates a new pull_request with fallback title and author when not provided', async () => {
      const row = generatePullRequestHydrationData({
        repo_full_name: ref.repoFullName,
        pr_number: ref.prNumber,
        title: '<unknown>',
        author_login: '<unknown>',
      });

      const { prisma } = createMockPrismaClient({
        pullRequest: { findUnique: createResolvedMock(null), create: createResolvedMock(row) },
      });
      const sut = new PullRequestRepositoryImpl(prisma, logger);

      const result = await sut.upsert(ref.repoFullName, ref.prNumber, { prState: PrState.open });

      expect(result).toStrictEqual({ id: row.id, created: true });
    });

    it('returns existing pull_request when it already exists', async () => {
      const existing = { id: getUniqueInt() };

      const { prisma, pullRequest } = createMockPrismaClient({
        pullRequest: { findUnique: createResolvedMock(existing) },
      });
      const sut = new PullRequestRepositoryImpl(prisma, logger);

      const result = await sut.upsert(ref.repoFullName, ref.prNumber, { prState: PrState.open });

      expect(pullRequest.findUnique).toHaveBeenCalled();
      expect(pullRequest.create).not.toHaveBeenCalled();
      expect(pullRequest.update).toHaveBeenCalledWith({
        where: { id: existing.id },
        data: { pr_state: 'open' },
      });
      expect(result).toStrictEqual({ id: existing.id, created: false });
      expect(logger.debug).toHaveBeenCalledWith(
        { fn: 'PullRequestRepositoryImpl.upsert', repoFullName: ref.repoFullName, prNumber: ref.prNumber, id: existing.id },
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

      await sut.upsert(ref.repoFullName, ref.prNumber, { prTitle, prState: PrState.open });

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

      await expect(sut.upsert(ref.repoFullName, ref.prNumber, { prTitle: 'Test', prState: PrState.open })).rejects.toBeDetailedError(
        'PRISMA_RECORD_NOT_FOUND_P2025',
        {
          message: "Record not found in table 'PullRequest'",
          functionName: 'PullRequestRepositoryImpl.upsert',
          details: { tableName: 'PullRequest' },
          cause: p2025,
        },
      );
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

      await sut.upsert(ref.repoFullName, ref.prNumber, { prState: PrState.closed });

      expect(mockCreate).toHaveBeenCalledWith({
        data: {
          repo_full_name: ref.repoFullName,
          pr_number: ref.prNumber,
          title: '<unknown>',
          author_login: '<unknown>',
          pr_state: 'closed',
          merged_at: null,
          closed_at: null,
          head_sha: null,
          head_committed_at: null,
          first_seen_at: frozenNow,
        },
      });
      expect(logger.debug).toHaveBeenCalledWith(
        { fn: 'PullRequestRepositoryImpl.upsert', repoFullName: ref.repoFullName, prNumber: ref.prNumber, id: row.id },
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

      await sut.upsert(ref.repoFullName, ref.prNumber, { prState: PrState.open, authorLogin });

      expect(mockCreate).toHaveBeenCalledWith({
        data: {
          repo_full_name: ref.repoFullName,
          pr_number: ref.prNumber,
          title: '<unknown>',
          author_login: authorLogin,
          pr_state: 'open',
          merged_at: null,
          closed_at: null,
          head_sha: null,
          head_committed_at: null,
          first_seen_at: frozenNow,
        },
      });
      expect(logger.debug).toHaveBeenCalledWith(
        { fn: 'PullRequestRepositoryImpl.upsert', repoFullName: ref.repoFullName, prNumber: ref.prNumber, id: row.id },
        'Created PullRequest',
      );
    });

    it('creates with mergedAt on create', async () => {
      const row = { id: getUniqueInt() };
      const mergedAt = getUniqueDate();
      const mockCreate = jest.fn<any>().mockResolvedValue(row);

      const { prisma } = createMockPrismaClient({
        pullRequest: { findUnique: createResolvedMock(null), create: mockCreate },
      });
      const sut = new PullRequestRepositoryImpl(prisma, logger);

      await sut.upsert(ref.repoFullName, ref.prNumber, { prState: PrState.merged, mergedAt });

      expect(mockCreate).toHaveBeenCalledWith({
        data: {
          repo_full_name: ref.repoFullName,
          pr_number: ref.prNumber,
          title: '<unknown>',
          author_login: '<unknown>',
          pr_state: 'merged',
          merged_at: mergedAt,
          closed_at: null,
          head_sha: null,
          head_committed_at: null,
          first_seen_at: frozenNow,
        },
      });
      expect(logger.debug).toHaveBeenCalledWith(
        { fn: 'PullRequestRepositoryImpl.upsert', repoFullName: ref.repoFullName, prNumber: ref.prNumber, id: row.id },
        'Created PullRequest',
      );
    });

    it('updates prState on existing PR', async () => {
      const existing = { id: getUniqueInt() };
      const { prisma, pullRequest } = createMockPrismaClient({
        pullRequest: { findUnique: createResolvedMock(existing) },
      });
      const sut = new PullRequestRepositoryImpl(prisma, logger);

      await sut.upsert(ref.repoFullName, ref.prNumber, { prState: PrState.merged });

      expect(pullRequest.update).toHaveBeenCalledWith({
        where: { id: existing.id },
        data: { pr_state: 'merged' },
      });
      expect(logger.debug).toHaveBeenCalledWith(
        { fn: 'PullRequestRepositoryImpl.upsert', repoFullName: ref.repoFullName, prNumber: ref.prNumber, id: existing.id },
        'PullRequest already exists',
      );
    });

    it('updates mergedAt on existing PR', async () => {
      const existing = { id: getUniqueInt() };
      const mergedAt = getUniqueDate();
      const { prisma, pullRequest } = createMockPrismaClient({
        pullRequest: { findUnique: createResolvedMock(existing) },
      });
      const sut = new PullRequestRepositoryImpl(prisma, logger);

      await sut.upsert(ref.repoFullName, ref.prNumber, { prState: PrState.merged, mergedAt });

      expect(pullRequest.update).toHaveBeenCalledWith({
        where: { id: existing.id },
        data: { pr_state: 'merged', merged_at: mergedAt },
      });
      expect(logger.debug).toHaveBeenCalledWith(
        { fn: 'PullRequestRepositoryImpl.upsert', repoFullName: ref.repoFullName, prNumber: ref.prNumber, id: existing.id },
        'PullRequest already exists',
      );
    });

    it('updates closedAt on existing PR', async () => {
      const existing = { id: getUniqueInt() };
      const closedAt = getUniqueDate();
      const { prisma, pullRequest } = createMockPrismaClient({
        pullRequest: { findUnique: createResolvedMock(existing) },
      });
      const sut = new PullRequestRepositoryImpl(prisma, logger);

      await sut.upsert(ref.repoFullName, ref.prNumber, { prState: PrState.closed, closedAt });

      expect(pullRequest.update).toHaveBeenCalledWith({
        where: { id: existing.id },
        data: { pr_state: 'closed', closed_at: closedAt },
      });
      expect(logger.debug).toHaveBeenCalledWith(
        { fn: 'PullRequestRepositoryImpl.upsert', repoFullName: ref.repoFullName, prNumber: ref.prNumber, id: existing.id },
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

      await sut.upsert(ref.repoFullName, ref.prNumber, { prState: PrState.open, authorLogin });

      expect(pullRequest.update).toHaveBeenCalledWith({
        where: { id: existing.id },
        data: { pr_state: 'open', author_login: authorLogin },
      });
      expect(logger.debug).toHaveBeenCalledWith(
        { fn: 'PullRequestRepositoryImpl.upsert', repoFullName: ref.repoFullName, prNumber: ref.prNumber, id: existing.id },
        'PullRequest already exists',
      );
    });
  });

  it('creates with head fields and records the sha observation', async () => {
    const headSha = getUniqueString({ prefix: 'head-' });
    const headCommittedAt = getUniqueDate();
    const row = { id: getUniqueInt() };
    const { prisma, pullRequest, pullRequestSha } = createMockPrismaClient({
      pullRequest: { findUnique: createResolvedMock(null), create: createResolvedMock(row) },
    });
    const sut = new PullRequestRepositoryImpl(prisma, logger);

    await sut.upsert(ref.repoFullName, ref.prNumber, { prState: PrState.open, headSha, headCommittedAt });

    expect(pullRequest.create).toHaveBeenCalledWith({
      data: {
        repo_full_name: ref.repoFullName,
        pr_number: ref.prNumber,
        title: '<unknown>',
        author_login: '<unknown>',
        pr_state: 'open',
        merged_at: null,
        closed_at: null,
        head_sha: headSha,
        head_committed_at: headCommittedAt,
        first_seen_at: frozenNow,
      },
    });
    expect(pullRequestSha.upsert).toHaveBeenCalledWith({
      where: { pull_request_id_sha: { pull_request_id: row.id, sha: headSha } },
      update: { last_observed_at: frozenNow },
      create: { pull_request_id: row.id, sha: headSha },
    });
  });

  it('updates head fields and refreshes the sha observation on an existing PR', async () => {
    const headSha = getUniqueString({ prefix: 'head-' });
    const headCommittedAt = getUniqueDate();
    const existing = { id: getUniqueInt() };
    const { prisma, pullRequest, pullRequestSha } = createMockPrismaClient({
      pullRequest: { findUnique: createResolvedMock(existing) },
    });
    const sut = new PullRequestRepositoryImpl(prisma, logger);

    await sut.upsert(ref.repoFullName, ref.prNumber, { prState: PrState.open, headSha, headCommittedAt });

    expect(pullRequest.update).toHaveBeenCalledWith({
      where: { id: existing.id },
      data: { pr_state: 'open', head_sha: headSha, head_committed_at: headCommittedAt },
    });
    expect(pullRequestSha.upsert).toHaveBeenCalledWith({
      where: { pull_request_id_sha: { pull_request_id: existing.id, sha: headSha } },
      update: { last_observed_at: frozenNow },
      create: { pull_request_id: existing.id, sha: headSha },
    });
  });

  it('does not touch the sha history when no head data is provided', async () => {
    const existing = { id: getUniqueInt() };
    const { prisma, pullRequestSha } = createMockPrismaClient({
      pullRequest: { findUnique: createResolvedMock(existing) },
    });
    const sut = new PullRequestRepositoryImpl(prisma, logger);

    await sut.upsert(ref.repoFullName, ref.prNumber, { prState: PrState.open });

    expect(pullRequestSha.upsert).not.toHaveBeenCalled();
  });

  describe('findByRepoAndPr', () => {
    it('returns the PR id and head sha when found', async () => {
      const headSha = getUniqueString({ prefix: 'head-' });
      const row = { id: getUniqueInt(), head_sha: headSha };
      const { prisma } = createMockPrismaClient({
        pullRequest: { findUnique: createResolvedMock(row) },
      });
      const sut = new PullRequestRepositoryImpl(prisma, logger);

      const result = await sut.findByRepoAndPr(ref.repoFullName, ref.prNumber);

      expect(result).toStrictEqual({ id: row.id, head_sha: headSha });
    });

    it('returns null when not found', async () => {
      const { prisma } = createMockPrismaClient({
        pullRequest: { findUnique: createResolvedMock(null) },
      });
      const sut = new PullRequestRepositoryImpl(prisma, logger);

      const result = await sut.findByRepoAndPr(ref.repoFullName, ref.prNumber);

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
      const findPrRef = generateReviewRef();
      const pr = {
        id: getUniqueInt(),
        repo_full_name: findPrRef.repoFullName,
        pr_number: findPrRef.prNumber,
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
    it('increments review_count, sets timestamps, and stores review verdict', async () => {
      const id = getUniqueInt();
      const reviewUrl = generateReviewRef().commentUrl;
      const reviewState = CodeRabbitCommentType.review_approved;
      const { prisma, pullRequest } = createMockPrismaClient();
      const sut = new PullRequestRepositoryImpl(prisma, logger);

      await sut.recordReview(id, reviewUrl, reviewState, undefined, prisma);

      expect(pullRequest.update).toHaveBeenCalledWith({
        where: { id },
        data: {
          review_count: { increment: 1 },
          last_coderabbit_review_at: frozenNow,
          last_review_url: reviewUrl,
          last_review_state: 'review_approved',
          reviewed_head_sha: null,
        },
      });
      expect(logger.debug).toHaveBeenCalledWith({ fn: 'PullRequestRepositoryImpl.recordReview', id }, 'Recorded review on PullRequest');
    });

    it('snapshots the current head sha as reviewed_head_sha', async () => {
      const id = getUniqueInt();
      const reviewUrl = generateReviewRef().commentUrl;
      const headSha = getUniqueString({ prefix: 'head-' });
      const { prisma, pullRequest } = createMockPrismaClient({
        pullRequest: { findUnique: createResolvedMock({ id, head_sha: headSha }) },
      });
      const sut = new PullRequestRepositoryImpl(prisma, logger);

      await sut.recordReview(id, reviewUrl, CodeRabbitCommentType.review_approved, undefined, prisma);

      expect(pullRequest.findUnique).toHaveBeenCalledWith({ where: { id }, select: { head_sha: true } });
      expect(pullRequest.update).toHaveBeenCalledWith({
        where: { id },
        data: {
          review_count: { increment: 1 },
          last_coderabbit_review_at: frozenNow,
          last_review_url: reviewUrl,
          last_review_state: 'review_approved',
          reviewed_head_sha: headSha,
        },
      });
    });

    it('stores review_changes_suggested verdict state', async () => {
      const id = getUniqueInt();
      const reviewUrl = generateReviewRef().commentUrl;
      const { prisma, pullRequest } = createMockPrismaClient();
      const sut = new PullRequestRepositoryImpl(prisma, logger);

      await sut.recordReview(id, reviewUrl, CodeRabbitCommentType.review_changes_suggested, undefined, prisma);

      expect(pullRequest.update).toHaveBeenCalledWith({
        where: { id },
        data: {
          review_count: { increment: 1 },
          last_coderabbit_review_at: frozenNow,
          last_review_url: reviewUrl,
          last_review_state: 'review_changes_suggested',
          reviewed_head_sha: null,
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

      await expect(
        sut.recordReview(getUniqueInt(), generateReviewRef().commentUrl, CodeRabbitCommentType.review_approved, undefined, prisma),
      ).rejects.toBeDetailedError('PRISMA_RECORD_NOT_FOUND_P2025', {
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
      const secondRowRef = generateReviewRef();
      const rows = [
        { id: getUniqueInt(), repo_full_name: ref.repoFullName, pr_number: ref.prNumber },
        { id: getUniqueInt(), repo_full_name: secondRowRef.repoFullName, pr_number: secondRowRef.prNumber },
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
      const staleRef1 = generateReviewRef();
      const staleRef2 = generateReviewRef();
      const rows = [
        {
          id: getUniqueInt(),
          repo_full_name: staleRef1.repoFullName,
          pr_number: staleRef1.prNumber,
          title: getUniqueString(),
          last_review_requested_at: lastReviewRequestedAt.toISOString(),
        },
        {
          id: getUniqueInt(),
          repo_full_name: staleRef2.repoFullName,
          pr_number: staleRef2.prNumber,
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
          "SELECT pr.id, pr.repo_full_name, pr.pr_number, pr.title, pr.last_review_requested_at FROM pull_request pr WHERE pr.pr_state = 'open' AND pr.last_review_requested_at IS NOT NULL AND (pr.last_coderabbit_review_at IS NULL OR pr.last_coderabbit_review_at < pr.last_review_requested_at) AND NOT EXISTS (SELECT 1 FROM review_queue rq WHERE rq.pull_request_id = pr.id AND rq.status IN ('pending', 'retriggered')) AND NOT EXISTS (SELECT 1 FROM review_queue rq WHERE rq.pull_request_id = pr.id AND rq.status = 'resolved' AND rq.resolved_at > datetime('now', '-5 minutes'))",
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

  describe('findTrackedPRs', () => {
    it('returns tracked PRs with last_coderabbit_review_at converted to Date or null', async () => {
      const reviewAt = getUniqueDate();
      const trackedRef1 = generateReviewRef();
      const trackedRef2 = generateReviewRef();
      const rowWithReview = {
        id: getUniqueInt(),
        title: getUniqueString(),
        repo_full_name: trackedRef1.repoFullName,
        pr_number: trackedRef1.prNumber,
        author_login: getUniqueString(),
        last_review_state: 'review_approved',
        last_coderabbit_review_at: reviewAt.toISOString(),
      };
      const rowWithoutReview = {
        id: getUniqueInt(),
        title: getUniqueString(),
        repo_full_name: trackedRef2.repoFullName,
        pr_number: trackedRef2.prNumber,
        author_login: getUniqueString(),
        last_review_state: null,
        last_coderabbit_review_at: null,
      };
      const rows = [rowWithReview, rowWithoutReview];
      const queryRawUnsafe = jest.fn<any>().mockResolvedValue(rows);
      const { prisma } = createMockPrismaClient({ $queryRawUnsafe: queryRawUnsafe });
      const sut = new PullRequestRepositoryImpl(prisma, logger);

      const result = await sut.findTrackedPRs();

      expect(queryRawUnsafe).toHaveBeenCalledWith(
        expect.toEqualIgnoringWhitespace(
          "SELECT pr.id, pr.title, pr.repo_full_name, pr.pr_number, pr.author_login, pr.last_review_state, pr.last_coderabbit_review_at FROM pull_request pr WHERE pr.pr_state = 'open' AND (pr.last_coderabbit_review_at IS NOT NULL OR pr.last_review_requested_at IS NOT NULL) AND pr.last_coderabbit_acknowledged_at IS NULL AND NOT EXISTS (SELECT 1 FROM review_queue rq WHERE rq.pull_request_id = pr.id AND rq.status IN ('pending', 'retriggered')) ORDER BY pr.last_coderabbit_review_at DESC NULLS LAST, pr.last_review_requested_at DESC NULLS LAST",
        ),
      );
      expect(result).toStrictEqual([
        { ...rowWithReview, last_coderabbit_review_at: new Date(rowWithReview.last_coderabbit_review_at) },
        { ...rowWithoutReview, last_coderabbit_review_at: null },
      ]);
      expect(logger.debug).toHaveBeenCalledWith({ fn: 'PullRequestRepositoryImpl.findTrackedPRs', count: rows.length }, 'Found tracked open PRs');
    });

    it('returns empty array when no tracked PRs exist', async () => {
      const { prisma } = createMockPrismaClient({ $queryRawUnsafe: jest.fn<any>().mockResolvedValue([]) });
      const sut = new PullRequestRepositoryImpl(prisma, logger);

      const result = await sut.findTrackedPRs();

      expect(result).toStrictEqual([]);
      expect(logger.debug).toHaveBeenCalledWith({ fn: 'PullRequestRepositoryImpl.findTrackedPRs', count: 0 }, 'Found tracked open PRs');
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
