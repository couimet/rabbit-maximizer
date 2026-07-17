import { BasePrismaRepository, PrismaUniqueConstraintViolationError } from '../external-deps/couimet/prisma-repo/index.js';
import { TYPES } from '../inversify-types.js';
import { CommentType } from '../types/CommentType.js';

import type { Logger } from '@couimet/logger-contract';
import { Prisma, type PrismaClient } from '@prisma/client';
import { inject, injectable } from 'inversify';

const LAST_BODY_PREVIEW_MAX_LENGTH = 1024;

export interface CoderabbitCommentRow {
  readonly id: number;
  readonly uuid: string;
  readonly pull_request_id: number;
  readonly comment_id: number;
  readonly url: string;
  readonly comment_type: CommentType;
  readonly last_body_preview: string | null;
  readonly gh_created_at: Date;
  readonly gh_updated_at: Date;
  readonly first_seen_at: Date;
  readonly last_seen_at: Date;
}

export interface UpsertCommentData {
  readonly comment_id: number;
  readonly pull_request_id: number;
  readonly url: string;
  readonly comment_type: CommentType;
  readonly body: string | null;
  readonly gh_created_at: Date;
  readonly gh_updated_at: Date;
}

export interface CoderabbitCommentRepository {
  upsert(data: UpsertCommentData, tx?: Prisma.TransactionClient): Promise<CoderabbitCommentRow>;
  deactivate(commentId: number, tx?: Prisma.TransactionClient): Promise<void>;
  findByPr(pullRequestId: number, tx?: Prisma.TransactionClient): Promise<CoderabbitCommentRow[]>;
  findActiveByType(pullRequestId: number, commentType: CommentType, tx?: Prisma.TransactionClient): Promise<CoderabbitCommentRow | undefined>;
}

@injectable()
export class CoderabbitCommentRepositoryImpl extends BasePrismaRepository implements CoderabbitCommentRepository {
  /* c8 ignore start — decorator emit branches */
  constructor(@inject(TYPES.PrismaClient) prisma: PrismaClient, @inject(TYPES.Logger) log: Logger) {
    super(prisma, Prisma.ModelName.CoderabbitComment, log, { softDelete: true });
  }
  /* c8 ignore stop */

  // eslint-disable-next-line require-await
  async upsert(data: UpsertCommentData, tx?: Prisma.TransactionClient): Promise<CoderabbitCommentRow> {
    return this.enforceTx(tx, async (db) => {
      const now = new Date();
      const lastBodyPreview = data.body !== null && data.body.length > 0 ? data.body.slice(0, LAST_BODY_PREVIEW_MAX_LENGTH) : null;

      const existing = await db.coderabbitComment.findFirst({
        where: { comment_id: data.comment_id },
        select: { id: true },
      });

      if (existing) {
        const updated = await this.withPrismaErrorHandling(
          () =>
            db.coderabbitComment.update({
              where: { id: existing.id },
              data: {
                url: data.url,
                comment_type: data.comment_type,
                last_body_preview: lastBodyPreview,
                gh_updated_at: data.gh_updated_at,
                last_seen_at: now,
              },
            }),
          'CoderabbitCommentRepositoryImpl.upsert',
        );
        this.log.debug({ fn: 'CoderabbitCommentRepositoryImpl.upsert', commentId: data.comment_id, id: existing.id }, 'Updated CoderabbitComment');
        return toRow(updated);
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
                last_body_preview: lastBodyPreview,
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
        return toRow(created);
      } catch (err) {
        if (err instanceof PrismaUniqueConstraintViolationError) {
          // Race: another request created this comment_id concurrently
          const winner = await db.coderabbitComment.findFirst({
            where: { comment_id: data.comment_id },
            select: { id: true },
          });
          if (winner) {
            const updated = await this.withPrismaErrorHandling(
              () =>
                db.coderabbitComment.update({
                  where: { id: winner.id },
                  data: {
                    url: data.url,
                    comment_type: data.comment_type,
                    last_body_preview: lastBodyPreview,
                    gh_updated_at: data.gh_updated_at,
                    last_seen_at: now,
                  },
                }),
              'CoderabbitCommentRepositoryImpl.upsert',
            );
            this.log.debug(
              { fn: 'CoderabbitCommentRepositoryImpl.upsert', commentId: data.comment_id, id: updated.id },
              'Updated CoderabbitComment (race recovery)',
            );
            return toRow(updated);
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
  async findByPr(pullRequestId: number, tx?: Prisma.TransactionClient): Promise<CoderabbitCommentRow[]> {
    return this.enforceTx(tx, async (db) => {
      const rows = await db.coderabbitComment.findMany({
        where: { pull_request_id: pullRequestId },
        orderBy: { gh_created_at: 'desc' },
      });
      return rows.map(toRow);
    });
  }

  // eslint-disable-next-line require-await
  async findActiveByType(pullRequestId: number, commentType: CommentType, tx?: Prisma.TransactionClient): Promise<CoderabbitCommentRow | undefined> {
    return this.enforceTx(tx, async (db) => {
      const row = await db.coderabbitComment.findFirst({
        where: { pull_request_id: pullRequestId, comment_type: commentType },
        orderBy: { gh_created_at: 'desc' },
      });
      return row ? toRow(row) : undefined;
    });
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const toRow = (row: any): CoderabbitCommentRow => ({
  id: row.id,
  uuid: row.uuid,
  pull_request_id: row.pull_request_id,
  comment_id: row.comment_id,
  url: row.url,
  comment_type: row.comment_type as CommentType,
  last_body_preview: row.last_body_preview,
  gh_created_at: row.gh_created_at,
  gh_updated_at: row.gh_updated_at,
  first_seen_at: row.first_seen_at,
  last_seen_at: row.last_seen_at,
});
