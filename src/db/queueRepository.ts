import { QueueStatus, TriggerSource, TYPES } from '../domain.js';
import { BasePrismaRepository, PrismaRecordNotFoundError, PrismaUniqueConstraintViolationError } from '../external-deps/couimet/prisma-repo/index.js';
import { ReviewQueueToQueueItemMapper } from '../mappers/index.js';
import type { ProbeFactory } from '../probes/index.js';
import { type CommentDetails, type CreateSkippedData, type EnqueueData, type EnqueueResult, type PaginatedResult, type QueueItem } from '../types/index.js';

import type { Logger } from '@couimet/logger-contract';
import { Prisma, type PrismaClient } from '@prisma/client';
import { inject, injectable } from 'inversify';

export interface QueueRepository {
  enqueue(data: EnqueueData, tx: Prisma.TransactionClient): Promise<EnqueueResult>;
  markRetriggered(id: number, cooldownUntil: Date, retriggerCommentUrl: string, tx: Prisma.TransactionClient): Promise<QueueItem>;
  markReviewed(id: number, tx: Prisma.TransactionClient): Promise<QueueItem>;
  markReviewedByUuid(uuid: string, tx?: Prisma.TransactionClient): Promise<QueueItem | undefined>;
  reschedule(id: number, sourceComment: CommentDetails, tx: Prisma.TransactionClient): Promise<QueueItem>;
  backoff(id: number, tx: Prisma.TransactionClient): Promise<QueueItem>;
  markFailed(id: number, tx: Prisma.TransactionClient): Promise<QueueItem>;
  findBySourceCommentId(commentId: number, tx?: Prisma.TransactionClient): Promise<QueueItem | undefined>;
  createSkipped(data: CreateSkippedData, tx: Prisma.TransactionClient): Promise<EnqueueResult>;
  getPendingQueue(tx?: Prisma.TransactionClient): Promise<QueueItem[]>;
  getRetriggeredQueue(tx?: Prisma.TransactionClient): Promise<QueueItem[]>;
  getTriggered(since: Date, skip: number, take: number, includeReviewed: boolean, tx?: Prisma.TransactionClient): Promise<PaginatedResult<QueueItem>>;
  getOldestPending(tx?: Prisma.TransactionClient): Promise<QueueItem | undefined>;
  getAll(skip: number, take: number, tx?: Prisma.TransactionClient): Promise<PaginatedResult<QueueItem>>;
  getCountsByStatus(tx?: Prisma.TransactionClient): Promise<Record<QueueStatus, number>>;
}

@injectable()
export class QueueRepositoryImpl extends BasePrismaRepository implements QueueRepository {
  /* c8 ignore start — decorator emit branches */
  constructor(
    @inject(TYPES.PrismaClient) prisma: PrismaClient,
    @inject(TYPES.ProbeFactory) private readonly probeFactory: ProbeFactory,
    @inject(TYPES.ReviewQueueToQueueItemMapper) private readonly mapper: ReviewQueueToQueueItemMapper,
    @inject(TYPES.Logger) log: Logger,
  ) {
    super(prisma, Prisma.ModelName.ReviewQueue, log);
  }
  /* c8 ignore stop */

  async enqueue(data: EnqueueData, tx: Prisma.TransactionClient): Promise<EnqueueResult> {
    const { repo, pr, prTitle, sourceCommentUrl, sourceCommentId, newWait } = data;
    const probe = this.probeFactory.createEnqueueProbe(tx);
    const db = this.client(tx);
    const recentRetriggered = await db.reviewQueue.findFirst({
      where: {
        repo_full_name: repo,
        pr_number: pr,
        status: QueueStatus.retriggered,
      },
    });
    if (recentRetriggered) {
      probe.recentlyRetriggered(repo, pr);
      return { item: this.mapper.fromReviewQueue(recentRetriggered), created: false };
    }

    try {
      const row = await this.withPrismaErrorHandling(
        () =>
          db.reviewQueue.create({
            data: {
              pull_request_id: data.pullRequestId,
              repo_full_name: repo,
              pr_number: pr,
              pr_title: prTitle,
              source_comment_url: sourceCommentUrl,
              source_comment_id: sourceCommentId,
              trigger_source: TriggerSource.scheduler,
            },
          }),
        'QueueRepositoryImpl.enqueue',
      );

      await db.queueOrder.create({ data: { queue_item_id: row.id } });

      await probe.enqueued({ repo, pr, newWait });

      return { item: this.mapper.fromReviewQueue(row), created: true };
    } catch (err) {
      if (err instanceof PrismaUniqueConstraintViolationError) {
        const existing = await db.reviewQueue.findFirst({
          where: {
            repo_full_name: repo,
            pr_number: pr,
            status: QueueStatus.pending,
          },
        });
        if (existing) {
          probe.alreadyQueued(repo, pr, existing.status);
          return { item: this.mapper.fromReviewQueue(existing), created: false };
        }
      }
      this.log.warn({ fn: 'QueueRepositoryImpl.enqueue', repo, pr, error: err }, 'Enqueue failed; rethrowing');
      throw err;
    }
  }

  async markRetriggered(id: number, cooldownUntil: Date, retriggerCommentUrl: string, tx: Prisma.TransactionClient): Promise<QueueItem> {
    const row = await this.withPrismaErrorHandling(
      () =>
        this.client(tx).reviewQueue.update({
          where: { id },
          data: {
            status: QueueStatus.retriggered,
            retriggered_at: new Date(),
            retrigger_comment_url: retriggerCommentUrl,
          },
        }),
      'QueueRepositoryImpl.markRetriggered',
    );
    this.log.debug({ fn: 'QueueRepositoryImpl.markRetriggered', id, cooldownUntil, retriggerCommentUrl }, 'Marked review retriggered');
    return this.mapper.fromReviewQueue(row);
  }

  async markReviewed(id: number, tx: Prisma.TransactionClient): Promise<QueueItem> {
    const row = await this.withPrismaErrorHandling(
      () =>
        this.client(tx).reviewQueue.update({
          where: { id },
          data: { status: QueueStatus.reviewed, reviewed_at: new Date() },
        }),
      'QueueRepositoryImpl.markReviewed',
    );
    this.log.debug({ fn: 'QueueRepositoryImpl.markReviewed', id }, 'Marked review reviewed');
    return this.mapper.fromReviewQueue(row);
  }

  // eslint-disable-next-line require-await
  async markReviewedByUuid(uuid: string, tx?: Prisma.TransactionClient): Promise<QueueItem | undefined> {
    return this.enforceTx(tx, async (db) => {
      const probe = this.probeFactory.createMarkQueueItemReviewedProbe(uuid);

      try {
        const updated = await this.withPrismaErrorHandling(
          () =>
            db.reviewQueue.update({
              where: { uuid },
              data: { status: QueueStatus.reviewed, reviewed_at: new Date() },
            }),
          'QueueRepositoryImpl.markReviewedByUuid',
        );
        await probe.queueItemMarkedReviewed(updated);
        return this.mapper.fromReviewQueue(updated);
      } catch (err) {
        if (err instanceof PrismaRecordNotFoundError) {
          probe.queueItemNotFound();
          return undefined;
        }
        throw err;
      }
    });
  }

  async reschedule(id: number, sourceComment: CommentDetails, tx: Prisma.TransactionClient): Promise<QueueItem> {
    const row = await this.withPrismaErrorHandling(
      () =>
        this.client(tx).reviewQueue.update({
          where: { id },
          data: {
            attempts: { increment: 1 },
            source_comment_id: sourceComment.commentId,
            source_comment_url: sourceComment.commentUrl,
          },
        }),
      'QueueRepositoryImpl.reschedule',
    );
    this.log.debug({ fn: 'QueueRepositoryImpl.reschedule', id }, 'Rescheduled review');
    return this.mapper.fromReviewQueue(row);
  }

  async backoff(id: number, tx: Prisma.TransactionClient): Promise<QueueItem> {
    const row = await this.withPrismaErrorHandling(
      () =>
        this.client(tx).reviewQueue.update({
          where: { id },
          data: {
            attempts: { increment: 1 },
          },
        }),
      'QueueRepositoryImpl.backoff',
    );
    this.log.debug({ fn: 'QueueRepositoryImpl.backoff', id }, 'Backoff applied');
    return this.mapper.fromReviewQueue(row);
  }

  async markFailed(id: number, tx: Prisma.TransactionClient): Promise<QueueItem> {
    const row = await this.withPrismaErrorHandling(
      () =>
        this.client(tx).reviewQueue.update({
          where: { id },
          data: { status: QueueStatus.failed, failed_at: new Date() },
        }),
      'QueueRepositoryImpl.markFailed',
    );
    this.log.debug({ fn: 'QueueRepositoryImpl.markFailed', id }, 'Marked review failed');
    return this.mapper.fromReviewQueue(row);
  }

  // eslint-disable-next-line require-await
  async findBySourceCommentId(commentId: number, tx?: Prisma.TransactionClient): Promise<QueueItem | undefined> {
    return this.enforceTx(tx, async (db) => {
      const row = await db.reviewQueue.findFirst({
        where: { source_comment_id: commentId },
      });
      this.log.debug({ fn: 'QueueRepositoryImpl.findBySourceCommentId', commentId, found: row !== null }, 'Searched by source comment ID');
      return row ? this.mapper.fromReviewQueue(row) : undefined;
    });
  }

  async createSkipped(data: CreateSkippedData, tx: Prisma.TransactionClient): Promise<EnqueueResult> {
    const { repo, pr, prTitle, sourceCommentUrl, sourceCommentId, pullRequestId } = data;
    try {
      const row = await this.withPrismaErrorHandling(
        () =>
          this.client(tx).reviewQueue.create({
            data: {
              pull_request_id: pullRequestId,
              repo_full_name: repo,
              pr_number: pr,
              pr_title: prTitle,
              source_comment_url: sourceCommentUrl,
              source_comment_id: sourceCommentId,
              status: QueueStatus.coderabbit_skipped,
            },
          }),
        'QueueRepositoryImpl.createSkipped',
      );
      this.log.debug({ fn: 'QueueRepositoryImpl.createSkipped', repo, pr, commentId: sourceCommentId }, 'Created coderabbit skipped entry');
      return { item: this.mapper.fromReviewQueue(row), created: true };
    } catch (err) {
      if (err instanceof PrismaUniqueConstraintViolationError) {
        const existing = await this.client(tx).reviewQueue.findFirst({
          where: { source_comment_id: sourceCommentId },
        });
        if (existing) {
          this.log.debug(
            { fn: 'QueueRepositoryImpl.createSkipped', repo, pr, commentId: sourceCommentId, status: existing.status },
            'Skipped entry already exists for this source comment',
          );
          return { item: this.mapper.fromReviewQueue(existing), created: false };
        }
      }
      this.log.warn({ fn: 'QueueRepositoryImpl.createSkipped', repo, pr, error: err }, 'Create skipped failed; rethrowing');
      throw err;
    }
  }

  // eslint-disable-next-line require-await
  async getPendingQueue(tx?: Prisma.TransactionClient): Promise<QueueItem[]> {
    return this.enforceTx(tx, async (db) => {
      const rows = await db.reviewQueue.findMany({
        where: { status: QueueStatus.pending },
        orderBy: { id: 'asc' },
      });
      this.log.debug({ fn: 'QueueRepositoryImpl.getPendingQueue', count: rows.length }, 'Fetched pending queue');
      return rows.map((row) => this.mapper.fromReviewQueue(row));
    });
  }

  // eslint-disable-next-line require-await
  async getRetriggeredQueue(tx?: Prisma.TransactionClient): Promise<QueueItem[]> {
    return this.enforceTx(tx, async (db) => {
      const rows = await db.reviewQueue.findMany({
        where: { status: QueueStatus.retriggered },
        orderBy: { retriggered_at: 'asc' },
      });
      this.log.debug({ fn: 'QueueRepositoryImpl.getRetriggeredQueue', count: rows.length }, 'Fetched retriggered queue');
      return rows.map((row) => this.mapper.fromReviewQueue(row));
    });
  }

  // eslint-disable-next-line require-await
  async getTriggered(since: Date, skip: number, take: number, includeReviewed: boolean, tx?: Prisma.TransactionClient): Promise<PaginatedResult<QueueItem>> {
    return this.enforceTx(tx, async (db) => {
      const statuses = includeReviewed ? [QueueStatus.retriggered, QueueStatus.reviewed] : [QueueStatus.retriggered];
      const where = { retriggered_at: { gte: since }, status: { in: statuses } };
      const [rows, total] = await Promise.all([
        db.reviewQueue.findMany({
          where,
          orderBy: { retriggered_at: 'desc' },
          skip,
          take,
        }),
        db.reviewQueue.count({ where }),
      ]);

      this.log.debug({ fn: 'QueueRepositoryImpl.getTriggered', since, skip, take, includeReviewed, count: rows.length, total }, 'Fetched triggered queue');
      return {
        items: rows.map((row) => this.mapper.fromReviewQueue(row)),
        total,
      };
    });
  }

  // eslint-disable-next-line require-await
  async getOldestPending(tx?: Prisma.TransactionClient): Promise<QueueItem | undefined> {
    return this.enforceTx(tx, async (db) => {
      const row = await db.reviewQueue.findFirst({
        where: { status: QueueStatus.pending },
        orderBy: { id: 'asc' },
      });
      this.log.debug({ fn: 'QueueRepositoryImpl.getOldestPending', found: row !== null }, 'Fetched oldest pending item');
      return row ? this.mapper.fromReviewQueue(row) : undefined;
    });
  }

  // eslint-disable-next-line require-await
  async getAll(skip: number, take: number, tx?: Prisma.TransactionClient): Promise<PaginatedResult<QueueItem>> {
    return this.enforceTx(tx, async (db) => {
      const [rows, total] = await Promise.all([db.reviewQueue.findMany({ orderBy: { id: 'asc' }, skip, take }), db.reviewQueue.count()]);
      this.log.debug({ fn: 'QueueRepositoryImpl.getAll', count: rows.length, total }, 'Fetched all queue items');
      return { items: rows.map((row) => this.mapper.fromReviewQueue(row)), total };
    });
  }

  // eslint-disable-next-line require-await
  async getCountsByStatus(tx?: Prisma.TransactionClient): Promise<Record<QueueStatus, number>> {
    return this.enforceTx(tx, async (db) => {
      const rows = await db.reviewQueue.groupBy({
        by: ['status'],
        _count: { status: true },
      });
      const counts: Record<QueueStatus, number> = { coderabbit_skipped: 0, failed: 0, pending: 0, retriggered: 0, reviewed: 0 };
      for (const row of rows) {
        counts[row.status as QueueStatus] = row._count.status;
      }
      this.log.debug({ fn: 'QueueRepositoryImpl.getCountsByStatus', counts }, 'Fetched queue counts by status');
      return counts;
    });
  }
}
