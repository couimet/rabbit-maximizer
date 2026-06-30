import { TYPES } from '../inversify-types.js';
import type { ObservationContext } from '../observability/observationContext.js';
import { EventType, type PaginatedResult, type QueueItem, QueueStatus } from '../types/index.js';

import type { EventRepository } from './eventRepository.js';

import type { Logger } from '@couimet/logger-contract';
import { Prisma, type PrismaClient, type ReviewQueue } from '@prisma/client';
import { inject, injectable } from 'inversify';

const UNIQUE_CONSTRAINT_VIOLATION = 'P2002';

export interface QueueRepository {
  enqueue(
    repo: string,
    pr: number,
    scheduledFor: Date,
    sourceCommentUrl: string,
    newWait: number,
    observation: ObservationContext,
    tx: Prisma.TransactionClient,
  ): Promise<QueueItem>;
  getNextDue(tx?: Prisma.TransactionClient): Promise<QueueItem | null>;
  markPosted(id: number, cooldownUntil: Date | undefined, tx: Prisma.TransactionClient): Promise<QueueItem>;
  markCompleted(id: number, tx: Prisma.TransactionClient): Promise<QueueItem>;
  reschedule(id: number, newScheduledFor: Date, tx: Prisma.TransactionClient): Promise<QueueItem>;
  markFailed(id: number, tx: Prisma.TransactionClient): Promise<QueueItem>;
  getPendingQueue(tx?: Prisma.TransactionClient): Promise<QueueItem[]>;
  getOldestPending(tx?: Prisma.TransactionClient): Promise<QueueItem | null>;
  getAll(skip: number, take: number, tx?: Prisma.TransactionClient): Promise<PaginatedResult<QueueItem>>;
  getCountsByStatus(tx?: Prisma.TransactionClient): Promise<Record<QueueStatus, number>>;
}

@injectable()
export class QueueRepositoryImpl implements QueueRepository {
  /* c8 ignore start — decorator emit branches */
  constructor(
    @inject(TYPES.PrismaClient) private readonly prisma: PrismaClient,
    @inject(TYPES.EventRepository) private readonly events: EventRepository,
    @inject(TYPES.Logger) private readonly log: Logger,
  ) {}
  /* c8 ignore stop */

  private client(tx?: Prisma.TransactionClient): Prisma.TransactionClient {
    return tx ?? this.prisma;
  }

  async enqueue(
    repo: string,
    pr: number,
    scheduledFor: Date,
    sourceCommentUrl: string,
    newWait: number,
    observation: ObservationContext,
    tx: Prisma.TransactionClient,
  ): Promise<QueueItem> {
    const db = this.client(tx);
    const recentPosted = await db.reviewQueue.findFirst({
      where: {
        repo_full_name: repo,
        pr_number: pr,
        status: QueueStatus.posted,
        scheduled_for: { gt: new Date() },
      },
    });
    if (recentPosted) {
      this.log.debug({ fn: 'QueueRepositoryImpl.enqueue', repo, pr }, 'PR was recently retriggered; skipping');
      return this.toQueueItem(recentPosted);
    }

    try {
      const row = await db.reviewQueue.create({
        data: {
          repo_full_name: repo,
          pr_number: pr,
          scheduled_for: scheduledFor,
          source_comment_url: sourceCommentUrl,
        },
      });

      await this.events.record(
        {
          type: EventType.enqueued,
          repo_full_name: repo,
          pr_number: pr,
          correlation_id: observation.correlationId,
          request_id: observation.requestId,
          version: observation.version,
          payload: {
            scheduled_for: scheduledFor,
            new_wait: newWait,
          },
        },
        tx,
      );

      this.log.debug({ fn: 'QueueRepositoryImpl.enqueue', repo, pr }, 'Enqueued review');
      return this.toQueueItem(row);
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === UNIQUE_CONSTRAINT_VIOLATION) {
        const existing = await db.reviewQueue.findFirst({
          where: {
            repo_full_name: repo,
            pr_number: pr,
            status: { in: [QueueStatus.pending, QueueStatus.posted] },
          },
        });
        if (existing) {
          this.log.debug({ fn: 'QueueRepositoryImpl.enqueue', repo, pr, status: existing.status }, 'Already queued; returning existing row');
          return this.toQueueItem(existing);
        }
      }
      this.log.warn({ fn: 'QueueRepositoryImpl.enqueue', repo, pr, error: err }, 'Enqueue failed; rethrowing');
      throw err;
    }
  }

  async getNextDue(tx?: Prisma.TransactionClient): Promise<QueueItem | null> {
    const row = await this.client(tx).reviewQueue.findFirst({
      where: {
        status: QueueStatus.pending,
        scheduled_for: { lte: new Date() },
      },
      orderBy: { scheduled_for: 'asc' },
    });
    this.log.debug({ fn: 'QueueRepositoryImpl.getNextDue', found: row !== null }, 'Fetched next due review');
    return row ? this.toQueueItem(row) : null;
  }

  async markPosted(id: number, cooldownUntil: Date | undefined, tx: Prisma.TransactionClient): Promise<QueueItem> {
    const data: { status: string; scheduled_for?: Date } = { status: QueueStatus.posted };
    if (cooldownUntil !== undefined) {
      data.scheduled_for = cooldownUntil;
    }
    const row = await this.client(tx).reviewQueue.update({
      where: { id },
      data,
    });
    this.log.debug({ fn: 'QueueRepositoryImpl.markPosted', id, cooldownUntil }, 'Marked review posted');
    return this.toQueueItem(row);
  }

  async markCompleted(id: number, tx: Prisma.TransactionClient): Promise<QueueItem> {
    const row = await this.client(tx).reviewQueue.update({
      where: { id },
      data: { status: QueueStatus.completed },
    });
    this.log.debug({ fn: 'QueueRepositoryImpl.markCompleted', id }, 'Marked review completed');
    return this.toQueueItem(row);
  }

  async reschedule(id: number, newScheduledFor: Date, tx: Prisma.TransactionClient): Promise<QueueItem> {
    const row = await this.client(tx).reviewQueue.update({
      where: { id },
      data: { attempts: { increment: 1 }, scheduled_for: newScheduledFor },
    });
    this.log.debug({ fn: 'QueueRepositoryImpl.reschedule', id }, 'Rescheduled review');
    return this.toQueueItem(row);
  }

  async markFailed(id: number, tx: Prisma.TransactionClient): Promise<QueueItem> {
    const row = await this.client(tx).reviewQueue.update({
      where: { id },
      data: { status: QueueStatus.failed },
    });
    this.log.debug({ fn: 'QueueRepositoryImpl.markFailed', id }, 'Marked review failed');
    return this.toQueueItem(row);
  }

  async getPendingQueue(tx?: Prisma.TransactionClient): Promise<QueueItem[]> {
    const rows = await this.client(tx).reviewQueue.findMany({
      where: { status: QueueStatus.pending },
      orderBy: { scheduled_for: 'asc' },
    });
    this.log.debug({ fn: 'QueueRepositoryImpl.getPendingQueue', count: rows.length }, 'Fetched pending queue');
    return rows.map((row) => this.toQueueItem(row));
  }

  async getOldestPending(tx?: Prisma.TransactionClient): Promise<QueueItem | null> {
    const row = await this.client(tx).reviewQueue.findFirst({
      where: { status: QueueStatus.pending },
      orderBy: { scheduled_for: 'asc' },
    });
    this.log.debug({ fn: 'QueueRepositoryImpl.getOldestPending', found: row !== null }, 'Fetched oldest pending item');
    return row ? this.toQueueItem(row) : null;
  }

  async getAll(skip: number, take: number, tx?: Prisma.TransactionClient): Promise<PaginatedResult<QueueItem>> {
    const db = this.client(tx);
    const [rows, total] = await Promise.all([db.reviewQueue.findMany({ orderBy: { scheduled_for: 'asc' }, skip, take }), db.reviewQueue.count()]);
    this.log.debug({ fn: 'QueueRepositoryImpl.getAll', count: rows.length, total }, 'Fetched all queue items');
    return { items: rows.map((row) => this.toQueueItem(row)), total };
  }

  async getCountsByStatus(tx?: Prisma.TransactionClient): Promise<Record<QueueStatus, number>> {
    const db = this.client(tx);
    const rows = await db.reviewQueue.groupBy({
      by: ['status'],
      _count: { status: true },
    });
    const counts: Record<QueueStatus, number> = { pending: 0, posted: 0, completed: 0, failed: 0 };
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
      status: row.status as QueueStatus,
      scheduled_for: row.scheduled_for,
      attempts: row.attempts,
      source_comment_url: row.source_comment_url ?? undefined,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }
}
