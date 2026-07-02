import { TYPES } from '../inversify-types.js';
import type { QueueItem, QueueStatus } from '../types/index.js';

import { BasePrismaRepository } from './BasePrismaRepository.js';

import type { Logger } from '@couimet/logger-contract';
import { Prisma, type PrismaClient, type QueueOrder, type ReviewQueue } from '@prisma/client';
import { inject, injectable } from 'inversify';

export type MoveDirection = 'up' | 'down';

export interface QueueOrderRepository {
  getEffectiveOrder(options?: { eligibleOnly?: boolean }): Promise<QueueItem[]>;
  moveItems(queueItemIds: number[], direction: MoveDirection): Promise<QueueItem[]>;
}

@injectable()
export class QueueOrderRepositoryImpl extends BasePrismaRepository implements QueueOrderRepository {
  constructor(@inject(TYPES.PrismaClient) prisma: PrismaClient, @inject(TYPES.Logger) log: Logger) {
    super(prisma, log);
  }

  getEffectiveOrder(options?: { eligibleOnly?: boolean }): Promise<QueueItem[]> {
    return this.readEffectiveOrder(undefined, options?.eligibleOnly ?? true);
  }

  private async readEffectiveOrder(tx?: Prisma.TransactionClient, eligibleOnly = true): Promise<QueueItem[]> {
    const db = this.client(tx);
    const where: Prisma.ReviewQueueWhereInput = { status: 'pending' };
    if (eligibleOnly) {
      where.not_before = { lte: new Date() };
    }
    const rows = await db.reviewQueue.findMany({
      where,
      include: { queueOrder: true },
      orderBy: [{ queueOrder: { position: { sort: 'asc', nulls: 'last' } } }, { queueOrder: { id: 'asc' } }],
    });
    this.log.debug({ fn: 'QueueOrderRepositoryImpl.getEffectiveOrder', count: rows.length, eligibleOnly }, 'Fetched effective order');
    return rows.map((row) => this.toQueueItem(row));
  }

  moveItems(queueItemIds: number[], direction: MoveDirection): Promise<QueueItem[]> {
    return this.transaction(async (tx) => {
      const ordered = await this.readEffectiveOrder(tx, false);
      const orderedIds = ordered.map((item) => item.id);

      const sortedSelected = [...new Set(queueItemIds)].sort((a, b) => orderedIds.indexOf(a) - orderedIds.indexOf(b));
      if (direction === 'down') {
        sortedSelected.reverse();
      }

      const newOrder = [...orderedIds];
      for (const id of sortedSelected) {
        const idx = newOrder.indexOf(id);
        if (idx === -1) continue;

        const neighborIdx = direction === 'up' ? idx - 1 : idx + 1;
        if (neighborIdx < 0 || neighborIdx >= newOrder.length) continue;
        if (queueItemIds.includes(newOrder[neighborIdx])) continue;

        [newOrder[idx], newOrder[neighborIdx]] = [newOrder[neighborIdx], newOrder[idx]];
      }

      await this.normalizePositionsToOrder(tx, newOrder);

      this.log.debug({ fn: 'QueueOrderRepositoryImpl.moveItems', ids: queueItemIds, direction }, 'Moved items in queue order');

      return this.readEffectiveOrder(tx, false);
    });
  }

  private async normalizePositionsToOrder(db: Prisma.TransactionClient, orderedIds: number[]): Promise<void> {
    const pendingItems = await db.reviewQueue.findMany({
      where: { status: 'pending' },
      include: { queueOrder: true },
    });

    // Clear existing positions
    for (const item of pendingItems) {
      if (item.queueOrder) {
        await db.queueOrder.update({
          where: { id: item.queueOrder.id },
          data: { position: null },
        });
      }
    }

    // Assign new positions, creating queue_order rows for items that lack them (pre-migration backfill)
    const itemById = new Map(pendingItems.map((item) => [item.id, item]));
    for (let i = 0; i < orderedIds.length; i++) {
      const item = itemById.get(orderedIds[i]);
      /* c8 ignore next 2 — defensive: orderedIds are derived from readEffectiveOrder which returns pending items */
      if (!item) continue;

      if (item.queueOrder) {
        await db.queueOrder.update({
          where: { id: item.queueOrder.id },
          data: { position: i + 1 },
        });
      } else {
        await db.queueOrder.create({
          data: { queue_item_id: orderedIds[i], position: i + 1 },
        });
      }
    }

    this.log.debug({ fn: 'QueueOrderRepositoryImpl.normalizePositionsToOrder', count: orderedIds.length }, 'Normalized queue positions');
  }

  private toQueueItem(row: ReviewQueue & { queueOrder: QueueOrder | null }): QueueItem {
    return {
      id: row.id,
      uuid: row.uuid,
      repo_full_name: row.repo_full_name,
      pr_number: row.pr_number,
      status: row.status as QueueStatus,
      not_before: row.not_before,
      attempts: row.attempts,
      source_comment_url: row.source_comment_url ?? undefined,
      posted_at: row.posted_at ?? undefined,
      failed_at: row.failed_at ?? undefined,
      completed_at: row.completed_at ?? undefined,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }
}
