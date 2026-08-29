import { CodeRabbitCommentType, TYPES } from '../domain.js';
import { BasePrismaRepository, PrismaUniqueConstraintViolationError } from '../external-deps/couimet/prisma-repo/index.js';
import { BODY_PREVIEW_MAX_LENGTH } from '../schemas/index.js';
import { truncateBodyPreview } from '../utils/index.js';

import type { Logger } from '@couimet/logger-contract';
import { type CoderabbitComment, Prisma, type PrismaClient } from '@prisma/client';
import { inject, injectable } from 'inversify';

const COMPLETED_REVIEW_TYPES: readonly CodeRabbitCommentType[] = [CodeRabbitCommentType.review_approved, CodeRabbitCommentType.review_changes_suggested];

export interface UpsertCommentData {
  readonly comment_id: number;
  readonly pull_request_id: number;
  readonly url: string;
  readonly comment_type: CodeRabbitCommentType;
  readonly body: string | null;
  readonly gh_created_at: Date;
  readonly gh_updated_at: Date;
  readonly coderabbit_run_id: string | null;
}

export interface CoderabbitCommentRepository {
  upsert(data: UpsertCommentData, tx?: Prisma.TransactionClient): Promise<CoderabbitComment>;
  deactivate(commentId: number, tx?: Prisma.TransactionClient): Promise<void>;
  findByPr(pullRequestId: number, tx?: Prisma.TransactionClient): Promise<CoderabbitComment[]>;
  findByCommentId(pullRequestId: number, commentId: number, tx?: Prisma.TransactionClient): Promise<CoderabbitComment | undefined>;
  findByType(pullRequestId: number, commentType: CodeRabbitCommentType, tx?: Prisma.TransactionClient): Promise<CoderabbitComment | undefined>;
  findCompletedReview(pullRequestId: number, tx?: Prisma.TransactionClient): Promise<CoderabbitComment | undefined>;
}

@injectable()
export class CoderabbitCommentRepositoryImpl extends BasePrismaRepository implements CoderabbitCommentRepository {
  /* c8 ignore start — decorator emit branches */
  constructor(@inject(TYPES.PrismaClient) prisma: PrismaClient, @inject(TYPES.Logger) log: Logger) {
    super(prisma, Prisma.ModelName.CoderabbitComment, log, { softDelete: true });
  }
  /* c8 ignore stop */

  // eslint-disable-next-line require-await
  async upsert(data: UpsertCommentData, tx?: Prisma.TransactionClient): Promise<CoderabbitComment> {
    return this.enforceTx(tx, async (db) => {
      const now = new Date();
      const lastBodyPreviewForSql: string | null = truncateBodyPreview(data.body, BODY_PREVIEW_MAX_LENGTH) ?? null;

      const existing = await db.coderabbitComment.findFirst({
        where: { comment_id: data.comment_id },
        select: { id: true },
      });

      if (existing) {
        await this.withPrismaErrorHandling(
          () =>
            db.coderabbitComment.updateMany({
              where: { id: existing.id, gh_updated_at: { lte: data.gh_updated_at } },
              data: {
                url: data.url,
                comment_type: data.comment_type,
                last_body_preview: lastBodyPreviewForSql,
                coderabbit_run_id: data.coderabbit_run_id,
                gh_updated_at: data.gh_updated_at,
                last_seen_at: now,
              },
            }),
          'CoderabbitCommentRepositoryImpl.upsert',
        );
        // updateMany returns only a count; re-read the row so a newer stored revision is returned when the stale delivery is rejected
        const updated = await db.coderabbitComment.findFirst({ where: { id: existing.id } });
        this.log.debug({ fn: 'CoderabbitCommentRepositoryImpl.upsert', commentId: data.comment_id, id: updated!.id }, 'Updated CoderabbitComment');
        return updated!;
      }

      try {
        const created = await this.withPrismaErrorHandling(
          () =>
            db.coderabbitComment.create({
              data: {
                comment_id: data.comment_id,
                pull_request_id: data.pull_request_id,
                url: data.url,
                comment_type: data.comment_type,
                last_body_preview: lastBodyPreviewForSql,
                coderabbit_run_id: data.coderabbit_run_id,
                gh_created_at: data.gh_created_at,
                gh_updated_at: data.gh_updated_at,
                first_seen_at: now,
                last_seen_at: now,
                ...this.softDelete!.activeMarker,
              },
            }),
          'CoderabbitCommentRepositoryImpl.upsert',
        );
        this.log.debug({ fn: 'CoderabbitCommentRepositoryImpl.upsert', commentId: data.comment_id, id: created.id }, 'Created CoderabbitComment');
        return created;
      } catch (err) {
        if (err instanceof PrismaUniqueConstraintViolationError) {
          // Race: another request created this comment_id concurrently
          const winner = await db.coderabbitComment.findFirst({
            where: { comment_id: data.comment_id },
            select: { id: true },
          });
          if (winner) {
            await this.withPrismaErrorHandling(
              () =>
                db.coderabbitComment.updateMany({
                  where: { id: winner.id, gh_updated_at: { lte: data.gh_updated_at } },
                  data: {
                    url: data.url,
                    comment_type: data.comment_type,
                    last_body_preview: lastBodyPreviewForSql,
                    coderabbit_run_id: data.coderabbit_run_id,
                    gh_updated_at: data.gh_updated_at,
                    last_seen_at: now,
                  },
                }),
              'CoderabbitCommentRepositoryImpl.upsert',
            );
            const updated = await db.coderabbitComment.findFirst({ where: { id: winner.id } });
            this.log.debug(
              { fn: 'CoderabbitCommentRepositoryImpl.upsert', commentId: data.comment_id, id: updated!.id },
              'Updated CoderabbitComment (race recovery)',
            );
            return updated!;
          }
        }
        throw err;
      }
    });
  }

  // eslint-disable-next-line require-await
  async deactivate(commentId: number, tx?: Prisma.TransactionClient): Promise<void> {
    return this.softDeleteRow({ comment_id: commentId }, tx);
  }

  // eslint-disable-next-line require-await
  async findByPr(pullRequestId: number, tx?: Prisma.TransactionClient): Promise<CoderabbitComment[]> {
    return this.enforceTx(tx, async (db) => {
      const rows = await db.coderabbitComment.findMany({
        where: { pull_request_id: pullRequestId },
        orderBy: { gh_created_at: 'desc' },
      });
      return rows;
    });
  }

  // eslint-disable-next-line require-await
  async findByCommentId(pullRequestId: number, commentId: number, tx?: Prisma.TransactionClient): Promise<CoderabbitComment | undefined> {
    return this.enforceTx(tx, async (db) => {
      const row = await db.coderabbitComment.findFirst({
        where: { pull_request_id: pullRequestId, comment_id: commentId },
      });
      return row ?? undefined;
    });
  }

  // eslint-disable-next-line require-await
  async findByType(pullRequestId: number, commentType: CodeRabbitCommentType, tx?: Prisma.TransactionClient): Promise<CoderabbitComment | undefined> {
    return this.enforceTx(tx, async (db) => {
      const row = await db.coderabbitComment.findFirst({
        where: { pull_request_id: pullRequestId, comment_type: commentType },
        orderBy: { gh_created_at: 'desc' },
      });
      return row ?? undefined;
    });
  }

  // eslint-disable-next-line require-await
  async findCompletedReview(pullRequestId: number, tx?: Prisma.TransactionClient): Promise<CoderabbitComment | undefined> {
    return this.enforceTx(tx, async (db) => {
      const row = await db.coderabbitComment.findFirst({
        where: {
          pull_request_id: pullRequestId,
          comment_type: { in: [...COMPLETED_REVIEW_TYPES] },
        },
        orderBy: { gh_created_at: 'desc' },
      });
      return row ?? undefined;
    });
  }
}
