import { TYPES } from '../inversify-types.js';
import type { QueueItem, QueueStatus } from '../types/index.js';

import { BasePrismaRepository } from './BasePrismaRepository.js';

import type { Logger } from '@couimet/logger-contract';
import { Prisma, type PrismaClient, type QueueOrder, type ReviewQueue } from '@prisma/client';
import { inject, injectable } from 'inversify';

export type MoveDirection = 'up' | 'down';

const POSITION_BUMP_OFFSET = 10000;

export interface QueueOrderRepository {
  getEffectiveOrder(): Promise<QueueItem[]>;
  moveItems(queueItemIds: number[], direction: MoveDirection): Promise<QueueItem[]>;
}

@injectable()
export class QueueOrderRepositoryImpl extends BasePrismaRepository implements QueueOrderRepository {
  constructor(@inject(TYPES.PrismaClient) prisma: PrismaClient, @inject(TYPES.Logger) log: Logger) {
    super(prisma, log);
  }

  getEffectiveOrder(): Promise<QueueItem[]> {
    return this.readEffectiveOrder();
  }

  private async readEffectiveOrder(tx?: Prisma.TransactionClient): Promise<QueueItem[]> {
    const db = this.client(tx);
    const rows = await db.reviewQueue.findMany({
      where: { status: 'pending', not_before: { lte: new Date() } },
      include: { queueOrder: true },
      orderBy: [{ queueOrder: { position: { sort: 'asc', nulls: 'last' } } }, { queueOrder: { id: 'asc' } }],
    });
    this.log.debug({ fn: 'QueueOrderRepositoryImpl.getEffectiveOrder', count: rows.length }, 'Fetched effective order');
    return rows.map((row) => this.toQueueItem(row));
  }

  moveItems(queueItemIds: number[], direction: MoveDirection): Promise<QueueItem[]> {
    return this.transaction(async (tx) => {
      const ordered = await this.readEffectiveOrder(tx);
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

      return this.readEffectiveOrder(tx);
    });
  }

  private async normalizePositionsToOrder(db: Prisma.TransactionClient, orderedIds: number[]): Promise<void> {
    await db.$executeRawUnsafe(`UPDATE queue_order SET position = position + ${POSITION_BUMP_OFFSET} WHERE position IS NOT NULL`);

    const rows = await db.reviewQueue.findMany({
      where: { id: { in: orderedIds } },
      include: { queueOrder: true },
    });

    const idToQO = new Map<number, QueueOrder>();
    for (const row of rows) {
      if (row.queueOrder) {
        idToQO.set(row.id, row.queueOrder);
      }
    }

    for (let i = 0; i < orderedIds.length; i++) {
      const qo = idToQO.get(orderedIds[i]);
      if (qo) {
        await db.queueOrder.update({
          where: { id: qo.id },
          data: { position: i + 1 },
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
