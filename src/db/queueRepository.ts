import { inject, injectable } from "inversify";
import type { Logger } from "@couimet/logger-contract";
import { Prisma, type PrismaClient, type ReviewQueue } from "@prisma/client";
import { TYPES } from "../inversify-types.js";
import { QueueStatus, type QueueItem } from "../types/index.js";

const UNIQUE_CONSTRAINT_VIOLATION = "P2002";

export interface QueueRepository {
  enqueue(
    repo: string,
    pr: number,
    scheduledFor: Date,
    tx?: Prisma.TransactionClient,
  ): Promise<QueueItem>;
  getNextDue(tx?: Prisma.TransactionClient): Promise<QueueItem | null>;
  markCompleted(id: number, tx?: Prisma.TransactionClient): Promise<QueueItem>;
  reschedule(
    id: number,
    newScheduledFor: Date,
    tx?: Prisma.TransactionClient,
  ): Promise<QueueItem>;
  markFailed(id: number, tx?: Prisma.TransactionClient): Promise<QueueItem>;
  getPendingQueue(tx?: Prisma.TransactionClient): Promise<QueueItem[]>;
}

@injectable()
export class QueueRepositoryImpl implements QueueRepository {
  /* c8 ignore start — decorator emit branches */
  constructor(
    @inject(TYPES.PrismaClient) private readonly prisma: PrismaClient,
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
    tx?: Prisma.TransactionClient,
  ): Promise<QueueItem> {
    const db = this.client(tx);
    try {
      const row = await db.reviewQueue.create({
        data: {
          repo_full_name: repo,
          pr_number: pr,
          scheduled_for: scheduledFor,
        },
      });
      this.log.debug(
        { fn: "QueueRepositoryImpl.enqueue", repo, pr },
        "Enqueued review",
      );
      return this.toQueueItem(row);
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === UNIQUE_CONSTRAINT_VIOLATION
      ) {
        const existing = await db.reviewQueue.findFirst({
          where: {
            repo_full_name: repo,
            pr_number: pr,
            status: QueueStatus.pending,
          },
        });
        if (existing) {
          this.log.debug(
            { fn: "QueueRepositoryImpl.enqueue", repo, pr },
            "Already queued; returning existing pending row",
          );
          return this.toQueueItem(existing);
        }
      }
      throw err;
    }
  }

  async getNextDue(tx?: Prisma.TransactionClient): Promise<QueueItem | null> {
    const row = await this.client(tx).reviewQueue.findFirst({
      where: {
        status: QueueStatus.pending,
        scheduled_for: { lte: new Date() },
      },
      orderBy: { scheduled_for: "asc" },
    });
    this.log.debug(
      { fn: "QueueRepositoryImpl.getNextDue", found: row !== null },
      "Fetched next due review",
    );
    return row ? this.toQueueItem(row) : null;
  }

  async markCompleted(
    id: number,
    tx?: Prisma.TransactionClient,
  ): Promise<QueueItem> {
    const row = await this.client(tx).reviewQueue.update({
      where: { id },
      data: { status: QueueStatus.completed },
    });
    this.log.debug(
      { fn: "QueueRepositoryImpl.markCompleted", id },
      "Marked review completed",
    );
    return this.toQueueItem(row);
  }

  async reschedule(
    id: number,
    newScheduledFor: Date,
    tx?: Prisma.TransactionClient,
  ): Promise<QueueItem> {
    const row = await this.client(tx).reviewQueue.update({
      where: { id },
      data: { attempts: { increment: 1 }, scheduled_for: newScheduledFor },
    });
    this.log.debug(
      { fn: "QueueRepositoryImpl.reschedule", id },
      "Rescheduled review",
    );
    return this.toQueueItem(row);
  }

  async markFailed(
    id: number,
    tx?: Prisma.TransactionClient,
  ): Promise<QueueItem> {
    const row = await this.client(tx).reviewQueue.update({
      where: { id },
      data: { status: QueueStatus.failed },
    });
    this.log.debug(
      { fn: "QueueRepositoryImpl.markFailed", id },
      "Marked review failed",
    );
    return this.toQueueItem(row);
  }

  async getPendingQueue(tx?: Prisma.TransactionClient): Promise<QueueItem[]> {
    const rows = await this.client(tx).reviewQueue.findMany({
      where: { status: QueueStatus.pending },
      orderBy: { scheduled_for: "asc" },
    });
    this.log.debug(
      { fn: "QueueRepositoryImpl.getPendingQueue", count: rows.length },
      "Fetched pending queue",
    );
    return rows.map((row) => this.toQueueItem(row));
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
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }
}
