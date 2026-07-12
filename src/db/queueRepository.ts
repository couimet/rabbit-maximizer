import { TYPES } from '../inversify-types.js';
import type { ObservationContext } from '../observability/observationContext.js';
import type { ProbeFactory } from '../probes/ProbeFactory.js';
import {
  type CommentDetails,
  type EnqueueData,
  type EnqueueResult,
  EventType,
  type PaginatedResult,
  type QueueItem,
  QueueStatus,
  TriggerSource,
} from '../types/index.js';

import { BasePrismaRepository } from './BasePrismaRepository.js';
import type { EventRepository } from './eventRepository.js';

import type { Logger } from '@couimet/logger-contract';
import { Prisma, type PrismaClient, type ReviewQueue } from '@prisma/client';
import { inject, injectable } from 'inversify';

const UNIQUE_CONSTRAINT_VIOLATION = 'P2002';

export interface QueueRepository {
  enqueue(data: EnqueueData, observation: ObservationContext, tx: Prisma.TransactionClient): Promise<EnqueueResult>;
  markRetriggered(id: number, cooldownUntil: Date, retriggerCommentUrl: string, tx: Prisma.TransactionClient): Promise<QueueItem>;
  markReviewed(id: number, tx: Prisma.TransactionClient): Promise<QueueItem>;
  // TODO [2026-07-15]: #126 — revisit optional tx holistically; several methods use mandatory tx but could benefit from enforceTx()
  markReviewedByUuid(uuid: string, tx?: Prisma.TransactionClient): Promise<QueueItem | undefined>;
  reschedule(id: number, newNotBefore: Date, sourceComment: CommentDetails, tx: Prisma.TransactionClient): Promise<QueueItem>;
  backoff(id: number, newNotBefore: Date, tx: Prisma.TransactionClient): Promise<QueueItem>;
  markFailed(id: number, tx: Prisma.TransactionClient): Promise<QueueItem>;
  getPendingQueue(tx?: Prisma.TransactionClient): Promise<QueueItem[]>;
  getRetriggeredQueue(tx?: Prisma.TransactionClient): Promise<QueueItem[]>;
  getTriggered(since: Date, skip: number, take: number, includeReviewed: boolean, tx?: Prisma.TransactionClient): Promise<PaginatedResult<QueueItem>>;
  getOldestPending(tx?: Prisma.TransactionClient): Promise<QueueItem | null>;
  getAll(skip: number, take: number, tx?: Prisma.TransactionClient): Promise<PaginatedResult<QueueItem>>;
  getCountsByStatus(tx?: Prisma.TransactionClient): Promise<Record<QueueStatus, number>>;
}

@injectable()
export class QueueRepositoryImpl extends BasePrismaRepository implements QueueRepository {
  /* c8 ignore start — decorator emit branches */
  constructor(
    @inject(TYPES.PrismaClient) prisma: PrismaClient,
    // TODO [2026-07-15]: #123 — remove once enqueue() event recording moves to EnqueueProbe
    @inject(TYPES.EventRepository) private readonly events: EventRepository,
    @inject(TYPES.ProbeFactory) private readonly probeFactory: ProbeFactory,
    @inject(TYPES.Logger) log: Logger,
  ) {
    super(prisma, log);
  }
  /* c8 ignore stop */

  async enqueue(data: EnqueueData, observation: ObservationContext, tx: Prisma.TransactionClient): Promise<EnqueueResult> {
    const { repo, pr, prTitle, notBefore, sourceCommentUrl, sourceCommentId, newWait } = data;
    const db = this.client(tx);
    const recentRetriggered = await db.reviewQueue.findFirst({
      where: {
        repo_full_name: repo,
        pr_number: pr,
        status: QueueStatus.retriggered,
        not_before: { gt: new Date() },
      },
    });
    if (recentRetriggered) {
      this.log.debug({ fn: 'QueueRepositoryImpl.enqueue', repo, pr }, 'PR was recently retriggered; skipping');
      return { item: this.toQueueItem(recentRetriggered), created: false };
    }

    try {
      const row = await db.reviewQueue.create({
        data: {
          repo_full_name: repo,
          pr_number: pr,
          pr_title: prTitle,
          not_before: notBefore,
          source_comment_url: sourceCommentUrl,
          source_comment_id: sourceCommentId,
          trigger_source: TriggerSource.scheduler,
        },
      });

      await db.queueOrder.create({ data: { queue_item_id: row.id } });

      // TODO [2026-07-15]: #123 — EnqueueProbe: encapsulate event recording so QueueRepositoryImpl only deals with reviewQueue rows
      await this.events.record(
        {
          type: EventType.enqueued,
          repo_full_name: repo,
          pr_number: pr,
          correlation_id: observation.correlationId,
          request_id: observation.requestId,
          version: observation.version,
          payload: {
            not_before: notBefore,
            new_wait: newWait,
          },
        },
        tx,
      );

      this.log.debug({ fn: 'QueueRepositoryImpl.enqueue', repo, pr }, 'Enqueued review');
      return { item: this.toQueueItem(row), created: true };
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === UNIQUE_CONSTRAINT_VIOLATION) {
        const existing = await db.reviewQueue.findFirst({
          where: {
            repo_full_name: repo,
            pr_number: pr,
            status: QueueStatus.pending,
          },
        });
        if (existing) {
          if (existing.not_before.getTime() !== notBefore.getTime()) {
            const updated = await db.reviewQueue.update({ where: { id: existing.id }, data: { not_before: notBefore } });
            this.log.debug(
              { fn: 'QueueRepositoryImpl.enqueue', repo, pr, oldNotBefore: existing.not_before, newNotBefore: notBefore },
              'Updated not_before on re-detection',
            );
            return { item: this.toQueueItem(updated), created: false };
          }
          this.log.debug({ fn: 'QueueRepositoryImpl.enqueue', repo, pr, status: existing.status }, 'Already queued; returning existing row');
          return { item: this.toQueueItem(existing), created: false };
        }
      }
      this.log.warn({ fn: 'QueueRepositoryImpl.enqueue', repo, pr, error: err }, 'Enqueue failed; rethrowing');
      throw err;
    }
  }

  async markRetriggered(id: number, cooldownUntil: Date, retriggerCommentUrl: string, tx: Prisma.TransactionClient): Promise<QueueItem> {
    const row = await this.client(tx).reviewQueue.update({
      where: { id },
      data: {
        status: QueueStatus.retriggered,
        retriggered_at: new Date(),
        retrigger_comment_url: retriggerCommentUrl,
        not_before: cooldownUntil,
      },
    });
    this.log.debug({ fn: 'QueueRepositoryImpl.markRetriggered', id, cooldownUntil, retriggerCommentUrl }, 'Marked review retriggered');
    return this.toQueueItem(row);
  }

  async markReviewed(id: number, tx: Prisma.TransactionClient): Promise<QueueItem> {
    const row = await this.client(tx).reviewQueue.update({
      where: { id },
      data: { status: QueueStatus.reviewed, reviewed_at: new Date() },
    });
    this.log.debug({ fn: 'QueueRepositoryImpl.markReviewed', id }, 'Marked review reviewed');
    return this.toQueueItem(row);
  }

  async markReviewedByUuid(uuid: string, tx?: Prisma.TransactionClient): Promise<QueueItem | undefined> {
    if (!tx) {
      return this.transaction((tx) => this.markReviewedByUuid(uuid, tx));
    }

    const db = this.client(tx);
    const probe = this.probeFactory.createMarkQueueItemReviewedProbe(uuid);

    const row = await db.reviewQueue.findUnique({ where: { uuid } });
    if (!row) {
      probe.queueItemNotFound();
      return undefined;
    }

    const updated = await db.reviewQueue.update({
      where: { id: row.id },
      data: { status: QueueStatus.reviewed, reviewed_at: new Date() },
    });
    await probe.queueItemMarkedReviewed(updated, db);

    return this.toQueueItem(updated);
  }

  async reschedule(id: number, newNotBefore: Date, sourceComment: CommentDetails, tx: Prisma.TransactionClient): Promise<QueueItem> {
    const row = await this.client(tx).reviewQueue.update({
      where: { id },
      data: {
        attempts: { increment: 1 },
        not_before: newNotBefore,
        source_comment_id: sourceComment.commentId,
        source_comment_url: sourceComment.commentUrl,
      },
    });
    this.log.debug({ fn: 'QueueRepositoryImpl.reschedule', id }, 'Rescheduled review');
    return this.toQueueItem(row);
  }

  async backoff(id: number, newNotBefore: Date, tx: Prisma.TransactionClient): Promise<QueueItem> {
    const row = await this.client(tx).reviewQueue.update({
      where: { id },
      data: {
        attempts: { increment: 1 },
        not_before: newNotBefore,
      },
    });
    this.log.debug({ fn: 'QueueRepositoryImpl.backoff', id }, 'Backoff applied');
    return this.toQueueItem(row);
  }

  async markFailed(id: number, tx: Prisma.TransactionClient): Promise<QueueItem> {
    const row = await this.client(tx).reviewQueue.update({
      where: { id },
      data: { status: QueueStatus.failed, failed_at: new Date() },
    });
    this.log.debug({ fn: 'QueueRepositoryImpl.markFailed', id }, 'Marked review failed');
    return this.toQueueItem(row);
  }

  async getPendingQueue(tx?: Prisma.TransactionClient): Promise<QueueItem[]> {
    const rows = await this.client(tx).reviewQueue.findMany({
      where: { status: QueueStatus.pending },
      orderBy: { not_before: 'asc' },
    });
    this.log.debug({ fn: 'QueueRepositoryImpl.getPendingQueue', count: rows.length }, 'Fetched pending queue');
    return rows.map((row) => this.toQueueItem(row));
  }

  async getRetriggeredQueue(tx?: Prisma.TransactionClient): Promise<QueueItem[]> {
    const rows = await this.client(tx).reviewQueue.findMany({
      where: { status: QueueStatus.retriggered },
      orderBy: { retriggered_at: 'asc' },
    });
    this.log.debug({ fn: 'QueueRepositoryImpl.getRetriggeredQueue', count: rows.length }, 'Fetched retriggered queue');
    return rows.map((row) => this.toQueueItem(row));
  }

  async getTriggered(since: Date, skip: number, take: number, includeReviewed: boolean, tx?: Prisma.TransactionClient): Promise<PaginatedResult<QueueItem>> {
    const db = this.client(tx);
    const statuses = includeReviewed ? [QueueStatus.retriggered, QueueStatus.reviewed] : [QueueStatus.retriggered];
    const where = { retriggered_at: { gte: since }, status: { in: statuses } };
    const [rows, total] = await Promise.all([
      db.reviewQueue.findMany({ where, orderBy: { retriggered_at: 'desc' }, skip, take }),
      db.reviewQueue.count({ where }),
    ]);

    this.log.debug({ fn: 'QueueRepositoryImpl.getTriggered', since, skip, take, includeReviewed, count: rows.length, total }, 'Fetched triggered queue');
    return { items: rows.map((row) => this.toQueueItem(row)), total };
  }

  async getOldestPending(tx?: Prisma.TransactionClient): Promise<QueueItem | null> {
    const row = await this.client(tx).reviewQueue.findFirst({
      where: { status: QueueStatus.pending },
      orderBy: { not_before: 'asc' },
    });
    this.log.debug({ fn: 'QueueRepositoryImpl.getOldestPending', found: row !== null }, 'Fetched oldest pending item');
    return row ? this.toQueueItem(row) : null;
  }

  async getAll(skip: number, take: number, tx?: Prisma.TransactionClient): Promise<PaginatedResult<QueueItem>> {
    const db = this.client(tx);
    const [rows, total] = await Promise.all([db.reviewQueue.findMany({ orderBy: { not_before: 'asc' }, skip, take }), db.reviewQueue.count()]);
    this.log.debug({ fn: 'QueueRepositoryImpl.getAll', count: rows.length, total }, 'Fetched all queue items');
    return { items: rows.map((row) => this.toQueueItem(row)), total };
  }

  async getCountsByStatus(tx?: Prisma.TransactionClient): Promise<Record<QueueStatus, number>> {
    const db = this.client(tx);
    const rows = await db.reviewQueue.groupBy({
      by: ['status'],
      _count: { status: true },
    });
    const counts: Record<QueueStatus, number> = { pending: 0, retriggered: 0, reviewed: 0, failed: 0 };
    for (const row of rows) {
      counts[row.status as QueueStatus] = row._count.status;
    }
    this.log.debug({ fn: 'QueueRepositoryImpl.getCountsByStatus', counts }, 'Fetched queue counts by status');
    return counts;
  }

  private toQueueItem(row: ReviewQueue): QueueItem {
    return {
      id: row.id,
      uuid: row.uuid,
      repo_full_name: row.repo_full_name,
      pr_number: row.pr_number,
      pr_title: row.pr_title,
      status: row.status as QueueStatus,
      not_before: row.not_before,
      attempts: row.attempts,
      source_comment_url: row.source_comment_url,
      source_comment_id: row.source_comment_id,
      trigger_source: row.trigger_source as TriggerSource,
      retrigger_comment_url: row.retrigger_comment_url ?? undefined,
      retriggered_at: row.retriggered_at ?? undefined,
      failed_at: row.failed_at ?? undefined,
      reviewed_at: row.reviewed_at ?? undefined,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }
}
