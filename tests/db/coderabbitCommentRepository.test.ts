import { CoderabbitCommentRepositoryImpl, type UpsertCommentData } from '../../src/db/coderabbitCommentRepository.js';
import { PrismaUniqueConstraintViolationError } from '../../src/external-deps/couimet/prisma-repo/index.js';
import { CommentType } from '../../src/types/CommentType.js';
import { createMockPrismaClient } from '../helpers/index.js';

import { getRandomEnumValue, getUniqueDate, getUniqueInt, getUniqueString } from '@couimet/dynamic-testing';
import { createMockLogger } from '@couimet/logger-contract-testing';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { Prisma } from '@prisma/client';

const LAST_BODY_PREVIEW_MAX_LENGTH = 1024;

describe('CoderabbitCommentRepositoryImpl', () => {
  let frozenNow: Date;
  let logger: ReturnType<typeof createMockLogger>;

  beforeEach(() => {
    frozenNow = getUniqueDate();
    logger = createMockLogger();
    jest.useFakeTimers();
    jest.setSystemTime(frozenNow);
  });

  const makeData = (overrides?: Partial<UpsertCommentData>): UpsertCommentData => ({
    comment_id: getUniqueInt(),
    pull_request_id: getUniqueInt(),
    url: getUniqueString(),
    comment_type: getRandomEnumValue(CommentType),
    body: getUniqueString(),
    gh_created_at: getUniqueDate(),
    gh_updated_at: getUniqueDate(),
    ...overrides,
  });

  const makeRow = (overrides?: Record<string, unknown>) => ({
    id: getUniqueInt(),
    uuid: getUniqueString(),
    pull_request_id: getUniqueInt(),
    comment_id: getUniqueInt(),
    url: getUniqueString(),
    comment_type: getRandomEnumValue(CommentType),
    last_body_preview: getUniqueString(),
    gh_created_at: getUniqueDate(),
    gh_updated_at: getUniqueDate(),
    first_seen_at: getUniqueDate(),
    last_seen_at: getUniqueDate(),
    ...overrides,
  });

  describe('upsert', () => {
    it('creates a new coderabbit_comment row when none exists', async () => {
      const data = makeData();
      const created = makeRow({ id: getUniqueInt() });
      const { prisma, coderabbitComment } = createMockPrismaClient({
        coderabbitComment: { findFirst: jest.fn<any>().mockResolvedValue(null), create: jest.fn<any>().mockResolvedValue(created) },
      });
      const sut = new CoderabbitCommentRepositoryImpl(prisma, logger);

      const result = await sut.upsert(data);

      expect(coderabbitComment.create).toHaveBeenCalledWith({
        data: {
          comment_id: data.comment_id,
          pull_request_id: data.pull_request_id,
          url: data.url,
          comment_type: data.comment_type,
          last_body_preview: data.body!.slice(0, LAST_BODY_PREVIEW_MAX_LENGTH),
          gh_created_at: data.gh_created_at,
          gh_updated_at: data.gh_updated_at,
          first_seen_at: frozenNow,
          last_seen_at: frozenNow,
          is_not_deleted: true,
        },
      });
      expect(result.id).toBe(created.id);
      expect(logger.debug).toHaveBeenCalledWith(
        { fn: 'CoderabbitCommentRepositoryImpl.upsert', commentId: data.comment_id, id: created.id },
        'Created CoderabbitComment',
      );
    });

    it('updates an existing active row when matched on comment_id', async () => {
      const data = makeData();
      const existing = makeRow({ comment_id: data.comment_id });
      const updated = { ...existing, url: data.url };
      const { prisma, coderabbitComment } = createMockPrismaClient({
        coderabbitComment: { findFirst: jest.fn<any>().mockResolvedValue(existing), update: jest.fn<any>().mockResolvedValue(updated) },
      });
      const sut = new CoderabbitCommentRepositoryImpl(prisma, logger);

      const result = await sut.upsert(data);

      expect(coderabbitComment.update).toHaveBeenCalledWith({
        where: { id: existing.id },
        data: {
          url: data.url,
          comment_type: data.comment_type,
          last_body_preview: data.body!.slice(0, LAST_BODY_PREVIEW_MAX_LENGTH),
          gh_updated_at: data.gh_updated_at,
          last_seen_at: frozenNow,
        },
      });
      expect(result.id).toBe(existing.id);
      expect(logger.debug).toHaveBeenCalledWith(
        { fn: 'CoderabbitCommentRepositoryImpl.upsert', commentId: data.comment_id, id: existing.id },
        'Updated CoderabbitComment',
      );
    });

    it('sets last_body_preview to null when body is empty', async () => {
      const data = makeData({ body: '' });
      const createdRow = makeRow();
      const { prisma, coderabbitComment } = createMockPrismaClient({
        coderabbitComment: { findFirst: jest.fn<any>().mockResolvedValue(null), create: jest.fn<any>().mockResolvedValue(createdRow) },
      });
      const sut = new CoderabbitCommentRepositoryImpl(prisma, logger);

      await sut.upsert(data);

      expect(coderabbitComment.create).toHaveBeenCalledWith({
        data: {
          comment_id: data.comment_id,
          pull_request_id: data.pull_request_id,
          url: data.url,
          comment_type: data.comment_type,
          last_body_preview: null,
          gh_created_at: data.gh_created_at,
          gh_updated_at: data.gh_updated_at,
          first_seen_at: frozenNow,
          last_seen_at: frozenNow,
          is_not_deleted: true,
        },
      });
      expect(logger.debug).toHaveBeenCalledWith(
        { fn: 'CoderabbitCommentRepositoryImpl.upsert', commentId: data.comment_id, id: createdRow.id },
        'Created CoderabbitComment',
      );
    });

    it('sets last_body_preview to null when body is null', async () => {
      const data = makeData({ body: null });
      const createdRow = makeRow();
      const { prisma, coderabbitComment } = createMockPrismaClient({
        coderabbitComment: { findFirst: jest.fn<any>().mockResolvedValue(null), create: jest.fn<any>().mockResolvedValue(createdRow) },
      });
      const sut = new CoderabbitCommentRepositoryImpl(prisma, logger);

      await sut.upsert(data);

      expect(coderabbitComment.create).toHaveBeenCalledWith({
        data: {
          comment_id: data.comment_id,
          pull_request_id: data.pull_request_id,
          url: data.url,
          comment_type: data.comment_type,
          last_body_preview: null,
          gh_created_at: data.gh_created_at,
          gh_updated_at: data.gh_updated_at,
          first_seen_at: frozenNow,
          last_seen_at: frozenNow,
          is_not_deleted: true,
        },
      });
      expect(logger.debug).toHaveBeenCalledWith(
        { fn: 'CoderabbitCommentRepositoryImpl.upsert', commentId: data.comment_id, id: createdRow.id },
        'Created CoderabbitComment',
      );
    });

    it('wraps P2025 errors in PrismaRecordNotFoundError on update', async () => {
      const data = makeData();
      const existing = makeRow({ comment_id: data.comment_id });
      const p2025 = new Prisma.PrismaClientKnownRequestError('Record not found', { code: 'P2025', clientVersion: '7.8.0' });
      const { prisma } = createMockPrismaClient({
        coderabbitComment: { findFirst: jest.fn<any>().mockResolvedValue(existing), update: jest.fn<any>().mockRejectedValue(p2025) },
      });
      const sut = new CoderabbitCommentRepositoryImpl(prisma, logger);

      await expect(sut.upsert(data)).rejects.toBeDetailedError('PRISMA_RECORD_NOT_FOUND_P2025', {
        message: "Record not found in table 'CoderabbitComment'",
        functionName: 'CoderabbitCommentRepositoryImpl.upsert',
        details: { tableName: 'CoderabbitComment' },
        cause: p2025,
      });
      expect(logger.debug).toHaveBeenCalledWith(
        { fn: 'CoderabbitCommentRepositoryImpl.upsert', modelName: 'CoderabbitComment', prismaCode: 'P2025' },
        'Prisma record not found, throwing typed error',
      );
    });

    it('recovers from concurrent create by updating the winning row', async () => {
      const data = makeData();
      const p2002 = new PrismaUniqueConstraintViolationError({ tableName: 'CoderabbitComment' });
      const winningRow = makeRow({ comment_id: data.comment_id, id: getUniqueInt() });
      const updated = { ...winningRow, url: data.url };
      const { prisma, coderabbitComment } = createMockPrismaClient({
        coderabbitComment: {
          findFirst: jest.fn<any>().mockResolvedValue(null),
          create: jest.fn<any>().mockRejectedValue(p2002),
          update: jest.fn<any>().mockResolvedValue(updated),
        },
      });
      jest.spyOn(coderabbitComment, 'findFirst').mockResolvedValueOnce(null).mockResolvedValueOnce(winningRow);

      const sut = new CoderabbitCommentRepositoryImpl(prisma, logger);

      const result = await sut.upsert(data);

      expect(coderabbitComment.update).toHaveBeenCalledWith({
        where: { id: winningRow.id },
        data: {
          url: data.url,
          comment_type: data.comment_type,
          last_body_preview: data.body!.slice(0, LAST_BODY_PREVIEW_MAX_LENGTH),
          gh_updated_at: data.gh_updated_at,
          last_seen_at: frozenNow,
        },
      });
      expect(result.id).toBe(updated.id);
      expect(logger.debug).toHaveBeenCalledWith(
        { fn: 'CoderabbitCommentRepositoryImpl.upsert', commentId: data.comment_id, id: winningRow.id },
        'Updated CoderabbitComment (race recovery)',
      );
    });

    it('rethrows PrismaUniqueConstraintViolationError when no winning row found', async () => {
      const data = makeData();
      const p2002 = new Prisma.PrismaClientKnownRequestError('Unique constraint violation', { code: 'P2002', clientVersion: '7.8.0' });
      const { prisma } = createMockPrismaClient({
        coderabbitComment: {
          findFirst: jest.fn<any>().mockResolvedValue(null),
          create: jest.fn<any>().mockRejectedValue(p2002),
        },
      });
      const sut = new CoderabbitCommentRepositoryImpl(prisma, logger);

      await expect(sut.upsert(data)).rejects.toBeDetailedError('PRISMA_UNIQUE_CONSTRAINT_VIOLATION_P2002', {
        message: "Unique constraint violation in table 'CoderabbitComment'",
        functionName: 'CoderabbitCommentRepositoryImpl.upsert',
        details: { tableName: 'CoderabbitComment' },
        cause: p2002,
      });
      expect(logger.debug).toHaveBeenCalledWith(
        { fn: 'CoderabbitCommentRepositoryImpl.upsert', modelName: 'CoderabbitComment', prismaCode: 'P2002' },
        'Unique constraint violation, throwing typed error',
      );
    });
  });

  describe('deactivate', () => {
    it('sets is_not_deleted = null and deleted_at on the active row', async () => {
      const commentId = getUniqueInt();
      const { prisma, coderabbitComment } = createMockPrismaClient();
      const sut = new CoderabbitCommentRepositoryImpl(prisma, logger);

      await sut.deactivate(commentId);

      expect(coderabbitComment.updateMany).toHaveBeenCalledWith({
        where: { comment_id: commentId, is_not_deleted: true },
        data: { is_not_deleted: null, deleted_at: frozenNow },
      });
      expect(logger.debug).toHaveBeenCalledWith({ fn: 'BasePrismaRepository.softDeleteRow', modelName: 'CoderabbitComment' }, 'Deactivated row');
    });
  });

  describe('findByPr', () => {
    it('returns active comments for a PR ordered by gh_created_at DESC', async () => {
      const pullRequestId = getUniqueInt();
      const rows = [makeRow(), makeRow()];
      const { prisma, coderabbitComment } = createMockPrismaClient({
        coderabbitComment: { findMany: jest.fn<any>().mockResolvedValue(rows) },
      });
      const sut = new CoderabbitCommentRepositoryImpl(prisma, logger);

      const result = await sut.findByPr(pullRequestId);

      expect(coderabbitComment.findMany).toHaveBeenCalledWith({
        where: { pull_request_id: pullRequestId },
        orderBy: { gh_created_at: 'desc' },
      });
      expect(result).toHaveLength(2);
    });

    it('returns empty array when no comments exist', async () => {
      const { prisma } = createMockPrismaClient({
        coderabbitComment: { findMany: jest.fn<any>().mockResolvedValue([]) },
      });
      const sut = new CoderabbitCommentRepositoryImpl(prisma, logger);

      const result = await sut.findByPr(getUniqueInt());

      expect(result).toStrictEqual([]);
    });
  });

  describe('findActiveByType', () => {
    it('returns the most recent active comment of a given type', async () => {
      const pullRequestId = getUniqueInt();
      const commentType = CommentType.review_skipped;
      const row = makeRow({ comment_type: commentType });
      const { prisma, coderabbitComment } = createMockPrismaClient({
        coderabbitComment: { findFirst: jest.fn<any>().mockResolvedValue(row) },
      });
      const sut = new CoderabbitCommentRepositoryImpl(prisma, logger);

      const result = await sut.findActiveByType(pullRequestId, commentType);

      expect(coderabbitComment.findFirst).toHaveBeenCalledWith({
        where: { pull_request_id: pullRequestId, comment_type: commentType },
        orderBy: { gh_created_at: 'desc' },
      });
      expect(result).not.toBeUndefined();
      expect(result!.comment_type).toBe('review_skipped');
    });

    it('returns undefined when no matching comment exists', async () => {
      const { prisma } = createMockPrismaClient({
        coderabbitComment: { findFirst: jest.fn<any>().mockResolvedValue(null) },
      });
      const sut = new CoderabbitCommentRepositoryImpl(prisma, logger);

      const result = await sut.findActiveByType(getUniqueInt(), CommentType.review_approved);

      expect(result).toBeUndefined();
    });
  });
});
