import { QueueStatus, Resolution, SkipReason, TriggerSource, TYPES } from '../domain.js';
import { BasePrismaRepository, PrismaRecordNotFoundError, PrismaUniqueConstraintViolationError } from '../external-deps/couimet/prisma-repo/index.js';
import { ReviewQueueToQueueItemMapper } from '../mappers/index.js';
import type { ProbeFactory } from '../probes/index.js';
import { type CommentDetails, type CreateSkippedData, type EnqueueData, type EnqueueResult, type PaginatedResult, type QueueItem } from '../types/index.js';
import { MS_PER_MINUTE } from '../utils/index.js';

import type { Logger } from '@couimet/logger-contract';
import { Prisma, type PrismaClient } from '@prisma/client';
import { inject, injectable } from 'inversify';

const COMPLETED_GUARD_WINDOW_MS = 5 * MS_PER_MINUTE;
const MAX_SKIPPED_ITEMS = 50;
const REOPENABLE_RESOLUTIONS: readonly Resolution[] = [Resolution.ReviewCompleted, Resolution.Failed, Resolution.Skipped] as const;
const ACTIVE_STATUSES: readonly QueueStatus[] = [QueueStatus.pending, QueueStatus.retriggered] as const;

export interface QueueRepository {
  enqueue(data: EnqueueData, tx: Prisma.TransactionClient): Promise<EnqueueResult>;
  markRetriggered(id: number, cooldownUntil: Date, retriggerCommentUrl: string, tx: Prisma.TransactionClient): Promise<QueueItem>;
  markRetriggerSkipped(id: number, reason: SkipReason, tx: Prisma.TransactionClient): Promise<QueueItem>;
  markResolved(id: number, resolution: Resolution, tx: Prisma.TransactionClient): Promise<QueueItem>;
  markResolvedByUuid(uuid: string, resolution: Resolution, tx?: Prisma.TransactionClient): Promise<QueueItem | undefined>;
  reschedule(id: number, sourceComment: CommentDetails, originalSourceCommentUrl: string | undefined, tx: Prisma.TransactionClient): Promise<QueueItem>;
  backoff(id: number, tx: Prisma.TransactionClient): Promise<QueueItem>;
  findBySourceCommentId(commentId: number, tx?: Prisma.TransactionClient): Promise<QueueItem | undefined>;
  createSkipped(data: CreateSkippedData, tx: Prisma.TransactionClient): Promise<EnqueueResult>;
  resolveStaleRetriggered(maxAgeMs: number, tx: Prisma.TransactionClient): Promise<number>;
  getPendingQueue(tx?: Prisma.TransactionClient): Promise<QueueItem[]>;
  getRetriggeredQueue(tx?: Prisma.TransactionClient): Promise<QueueItem[]>;
  getActiveQueue(tx?: Prisma.TransactionClient): Promise<QueueItem[]>;
  getActivityList(since: Date, skip: number, take: number, tx?: Prisma.TransactionClient): Promise<PaginatedResult<QueueItem>>;
  getOldestPending(tx?: Prisma.TransactionClient): Promise<QueueItem | undefined>;
  getAll(skip: number, take: number, tx?: Prisma.TransactionClient): Promise<PaginatedResult<QueueItem>>;
  getCountsByStatus(tx?: Prisma.TransactionClient): Promise<Record<QueueStatus, number>>;
  getSkippedItems(tx?: Prisma.TransactionClient): Promise<QueueItem[]>;
  incrementAttempts(id: number, attempts: number, tx: Prisma.TransactionClient): Promise<void>;
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
    const { repo, pr, prTitle, sourceCommentUrl, sourceCommentId } = data;
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
      if (recentRetriggered.source_comment_id === sourceCommentId) {
        probe.recentlyRetriggered(repo, pr);
        return { item: this.mapper.fromReviewQueue(recentRetriggered), created: false };
      }
      const { count } = await db.reviewQueue.updateMany({
        where: { id: recentRetriggered.id, status: QueueStatus.retriggered },
        data: { source_comment_url: sourceCommentUrl, source_comment_id: sourceCommentId, retriggered_at: new Date() },
      });
      if (count === 0) {
        probe.recentlyRetriggered(repo, pr);
        return { item: this.mapper.fromReviewQueue(recentRetriggered), created: false };
      }
      probe.retriggeredReplaced(repo, pr, recentRetriggered.source_comment_id, sourceCommentId);
      return {
        item: this.mapper.fromReviewQueue({
          ...recentRetriggered,
          source_comment_url: sourceCommentUrl,
          source_comment_id: sourceCommentId,
          retriggered_at: new Date(),
        }),
        created: false,
      };
    }

    if (data.cooldownUntil && Date.now() < data.cooldownUntil.getTime()) {
      const cooldownResolved = await db.reviewQueue.findFirst({
        where: {
          repo_full_name: repo,
          pr_number: pr,
          source_comment_id: sourceCommentId,
          status: QueueStatus.resolved,
        },
      });
      if (cooldownResolved) {
        probe.recentlyResolved(repo, pr, cooldownResolved.uuid, sourceCommentId, cooldownResolved.resolved_at!);
        return { item: this.mapper.fromReviewQueue(cooldownResolved), created: false };
      }
    }

    const recentResolved = await db.reviewQueue.findFirst({
      where: {
        repo_full_name: repo,
        pr_number: pr,
        source_comment_id: sourceCommentId,
        status: QueueStatus.resolved,
        resolved_at: { gte: new Date(Date.now() - COMPLETED_GUARD_WINDOW_MS) },
      },
    });
    if (recentResolved) {
      probe.recentlyResolved(repo, pr, recentResolved.uuid, sourceCommentId, recentResolved.resolved_at!);
      return { item: this.mapper.fromReviewQueue(recentResolved), created: false };
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
              cooldown_until: data.cooldownUntil ?? null,
            },
          }),
        'QueueRepositoryImpl.enqueue',
      );

      await db.queueOrder.create({ data: { queue_item_id: row.id } });

      await probe.enqueued({ repo, pr });

      return { item: this.mapper.fromReviewQueue(row), created: true };
    } catch (err) {
      return this.handleEnqueueConflict(err, data, db, probe);
    }
  }

  private async handleEnqueueConflict(
    err: unknown,
    data: EnqueueData,
    db: Prisma.TransactionClient,
    probe: ReturnType<ProbeFactory['createEnqueueProbe']>,
  ): Promise<EnqueueResult> {
    const { repo, pr, prTitle, sourceCommentId } = data;

    if (err instanceof PrismaUniqueConstraintViolationError) {
      const existingPending = await db.reviewQueue.findFirst({
        where: {
          repo_full_name: repo,
          pr_number: pr,
          status: QueueStatus.pending,
        },
      });
      if (existingPending) {
        probe.alreadyQueued(repo, pr, existingPending.status);
        return { item: this.mapper.fromReviewQueue(existingPending), created: false };
      }

      const existingResolved = await db.reviewQueue.findFirst({
        where: {
          source_comment_id: sourceCommentId,
          status: QueueStatus.resolved,
          resolution: { in: [...REOPENABLE_RESOLUTIONS] },
        },
      });
      if (existingResolved) {
        if (data.commentUpdatedAt && data.commentUpdatedAt > existingResolved.resolved_at!) {
          const updated = await db.reviewQueue.update({
            where: { id: existingResolved.id },
            data: {
              status: QueueStatus.pending,
              resolution: null,
              resolved_at: null,
              pr_title: prTitle,
              cooldown_until: data.cooldownUntil ?? null,
              last_skipped_at: null,
              last_skip_reason: null,
              retrigger_skip_count: 0,
            },
          });

          const existingOrder = await db.queueOrder.findUnique({ where: { queue_item_id: existingResolved.id } });
          if (!existingOrder) {
            await db.queueOrder.create({ data: { queue_item_id: existingResolved.id } });
          }

          await probe.enqueued({ repo, pr });
          probe.resolvedReEnqueued(repo, pr, sourceCommentId);
          return { item: this.mapper.fromReviewQueue(updated), created: true };
        }
        probe.resolvedNotEdited(repo, pr, sourceCommentId);
        return { item: this.mapper.fromReviewQueue(existingResolved), created: false };
      }
    }
    this.log.warn({ fn: 'QueueRepositoryImpl.enqueue', repo, pr, error: err }, 'Enqueue failed; rethrowing');
    throw err;
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

  async markRetriggerSkipped(id: number, reason: SkipReason, tx: Prisma.TransactionClient): Promise<QueueItem> {
    const row = await this.withPrismaErrorHandling(
      () =>
        this.client(tx).reviewQueue.update({
          where: { id },
          data: {
            last_skipped_at: new Date(),
            last_skip_reason: reason,
            retrigger_skip_count: { increment: 1 },
          },
        }),
      'QueueRepositoryImpl.markRetriggerSkipped',
    );
    this.log.debug({ fn: 'QueueRepositoryImpl.markRetriggerSkipped', id, reason }, 'Marked review retrigger skipped');
    return this.mapper.fromReviewQueue(row);
  }

  async markResolved(id: number, resolution: Resolution, tx: Prisma.TransactionClient): Promise<QueueItem> {
    const row = await this.withPrismaErrorHandling(
      () =>
        this.client(tx).reviewQueue.update({
          where: { id },
          data: { status: QueueStatus.resolved, resolution, resolved_at: new Date() },
        }),
      'QueueRepositoryImpl.markResolved',
    );
    this.log.debug({ fn: 'QueueRepositoryImpl.markResolved', id, resolution }, 'Marked review resolved');
    return this.mapper.fromReviewQueue(row);
  }

  // eslint-disable-next-line require-await
  async markResolvedByUuid(uuid: string, resolution: Resolution, tx?: Prisma.TransactionClient): Promise<QueueItem | undefined> {
    return this.enforceTx(tx, async (db) => {
      const probe = this.probeFactory.createMarkQueueItemReviewedProbe(uuid);

      try {
        const updated = await this.withPrismaErrorHandling(
          () =>
            db.reviewQueue.update({
              where: { uuid },
              data: { status: QueueStatus.resolved, resolution, resolved_at: new Date() },
            }),
          'QueueRepositoryImpl.markResolvedByUuid',
        );
        probe.queueItemMarkedReviewed(updated);
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

  async reschedule(id: number, sourceComment: CommentDetails, originalSourceCommentUrl: string | undefined, tx: Prisma.TransactionClient): Promise<QueueItem> {
    try {
      const row = await this.withPrismaErrorHandling(
        () =>
          this.client(tx).reviewQueue.update({
            where: { id },
            data: {
              attempts: { increment: 1 },
              source_comment_id: sourceComment.commentId,
              source_comment_url: sourceComment.commentUrl,
              original_source_comment_url: originalSourceCommentUrl,
              retriggered_at: new Date(),
            },
          }),
        'QueueRepositoryImpl.reschedule',
      );
      this.log.debug({ fn: 'QueueRepositoryImpl.reschedule', id }, 'Rescheduled review');
      return this.mapper.fromReviewQueue(row);
    } catch (err) {
      if (err instanceof PrismaUniqueConstraintViolationError) {
        const db = this.client(tx);
        const existing = await db.reviewQueue.findFirst({
          where: { source_comment_id: sourceComment.commentId, status: QueueStatus.resolved },
        });
        if (existing && existing.status === QueueStatus.resolved) {
          await db.reviewQueue.update({
            where: { id },
            data: { status: QueueStatus.resolved, resolution: Resolution.ReviewCompleted, resolved_at: new Date() },
          });
          this.log.info(
            { fn: 'QueueRepositoryImpl.reschedule', id, existingId: existing.id, sourceCommentId: sourceComment.commentId },
            'Reschedule collision: source_comment_id already exists on a resolved row; marking current item as resolved',
          );
          return this.mapper.fromReviewQueue(existing);
        }
      }
      this.log.error(
        { fn: 'QueueRepositoryImpl.reschedule', id, sourceCommentId: sourceComment.commentId, error: err },
        'Reschedule failed with no existing row to recover; rethrowing',
      );
      throw err;
    }
  }

  async backoff(id: number, tx: Prisma.TransactionClient): Promise<QueueItem> {
    const row = await this.withPrismaErrorHandling(
      () =>
        this.client(tx).reviewQueue.update({
          where: { id },
          data: {
            attempts: { increment: 1 },
            status: QueueStatus.retriggered,
            retriggered_at: new Date(),
          },
        }),
      'QueueRepositoryImpl.backoff',
    );
    this.log.debug({ fn: 'QueueRepositoryImpl.backoff', id }, 'Backoff applied');
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
              status: QueueStatus.resolved,
              resolution: Resolution.Skipped,
              resolved_at: new Date(),
            },
          }),
        'QueueRepositoryImpl.createSkipped',
      );
      this.log.debug({ fn: 'QueueRepositoryImpl.createSkipped', repo, pr, commentId: sourceCommentId }, 'Created skipped entry');
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

  async resolveStaleRetriggered(maxAgeMs: number, tx: Prisma.TransactionClient): Promise<number> {
    const db = this.client(tx);
    const cutoff = new Date(Date.now() - maxAgeMs);
    const result = await db.reviewQueue.updateMany({
      where: {
        status: QueueStatus.retriggered,
        retriggered_at: { lt: cutoff },
      },
      data: {
        status: QueueStatus.resolved,
        resolution: Resolution.Failed,
        resolved_at: new Date(),
      },
    });
    return result.count;
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
  async getActiveQueue(tx?: Prisma.TransactionClient): Promise<QueueItem[]> {
    return this.enforceTx(tx, async (db) => {
      const rows = await db.reviewQueue.findMany({
        where: { status: { in: [...ACTIVE_STATUSES] } },
        orderBy: { id: 'asc' },
      });
      this.log.debug({ fn: 'QueueRepositoryImpl.getActiveQueue', count: rows.length }, 'Fetched active queue');
      return rows.map((row) => this.mapper.fromReviewQueue(row));
    });
  }

  // eslint-disable-next-line require-await
  async getActivityList(since: Date, skip: number, take: number, tx?: Prisma.TransactionClient): Promise<PaginatedResult<QueueItem>> {
    return this.enforceTx(tx, async (db) => {
      const where = { updated_at: { gte: since } };
      const [rows, total] = await Promise.all([
        db.reviewQueue.findMany({
          where,
          orderBy: { updated_at: 'desc' },
          skip,
          take,
        }),
        db.reviewQueue.count({ where }),
      ]);

      this.log.debug({ fn: 'QueueRepositoryImpl.getActivityList', since, skip, take, count: rows.length, total }, 'Fetched activity list');
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
      const counts: Record<QueueStatus, number> = { pending: 0, retriggered: 0, resolved: 0 };
      for (const row of rows) {
        counts[row.status as QueueStatus] = row._count.status;
      }
      this.log.debug({ fn: 'QueueRepositoryImpl.getCountsByStatus', counts }, 'Fetched queue counts by status');
      return counts;
    });
  }

  // eslint-disable-next-line require-await
  async getSkippedItems(tx?: Prisma.TransactionClient): Promise<QueueItem[]> {
    return this.enforceTx(tx, async (db) => {
      const rows = await db.reviewQueue.findMany({
        where: { status: QueueStatus.resolved, resolution: Resolution.Skipped },
        orderBy: { created_at: 'desc' },
        take: MAX_SKIPPED_ITEMS,
      });
      this.log.debug({ fn: 'QueueRepositoryImpl.getSkippedItems', count: rows.length }, 'Fetched skipped items');
      return rows.map((row) => this.mapper.fromReviewQueue(row));
    });
  }

  async incrementAttempts(id: number, attempts: number, tx: Prisma.TransactionClient): Promise<void> {
    await this.client(tx).reviewQueue.update({
      where: { id },
      data: { attempts },
    });
  }
}
