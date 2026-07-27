import { QueueStatus, TYPES } from '../domain.js';
import { RabbitMaximizerError, RabbitMaximizerErrorCodes } from '../errors/index.js';
import { BasePrismaRepository, PrismaRecordNotFoundError } from '../external-deps/couimet/prisma-repo/index.js';
import { ReviewQueueToQueueItemMapper } from '../mappers/index.js';
import type { QueueItem } from '../types/index.js';
import { findByUuid, resolveUuidsToIds } from '../utils/index.js';

import type { Logger } from '@couimet/logger-contract';
import { Prisma, type PrismaClient } from '@prisma/client';
import { inject, injectable } from 'inversify';

export type MoveDirection = 'up' | 'down';

/** Statuses that participate in the effective queue order. `pending` items are reorderable; `retriggered` items appear below them in cooldown. */
const EFFECTIVE_ORDER_STATUSES: readonly QueueStatus[] = [QueueStatus.pending, QueueStatus.retriggered] as const;

export interface QueueOrderRepository {
  getEffectiveOrder(): Promise<QueueItem[]>;
  moveItems(queueItemUuids: string[], direction: MoveDirection): Promise<QueueItem[]>;
  moveToTop(uuid: string): Promise<QueueItem>;
}

@injectable()
export class QueueOrderRepositoryImpl extends BasePrismaRepository implements QueueOrderRepository {
  /* c8 ignore start — decorator emit branches */
  constructor(
    @inject(TYPES.PrismaClient) prisma: PrismaClient,
    @inject(TYPES.ReviewQueueToQueueItemMapper) private readonly mapper: ReviewQueueToQueueItemMapper,
    @inject(TYPES.Logger) log: Logger,
  ) {
    super(prisma, Prisma.ModelName.QueueOrder, log);
  }
  /* c8 ignore stop */

  getEffectiveOrder(): Promise<QueueItem[]> {
    return this.readEffectiveOrder(undefined);
  }

  /**
   * Returns items with status `pending` or `retriggered` ordered so actionable
   * items always lead. `pending` sorts before `retriggered` alphabetically by
   * Prisma enum order, which is the desired behavior: pending items are
   * reorderable, retriggered items are in cooldown and cannot be moved.
   */
  private readEffectiveOrder(tx: Prisma.TransactionClient | undefined): Promise<QueueItem[]> {
    return this.enforceTx(tx, async (db) => {
      const where: Prisma.ReviewQueueWhereInput = { status: { in: [...EFFECTIVE_ORDER_STATUSES] } };
      const rows = await db.reviewQueue.findMany({
        where,
        include: { queueOrder: true },
        orderBy: [{ status: 'asc' }, { queueOrder: { position: { sort: 'asc', nulls: 'last' } } }, { queueOrder: { id: 'asc' } }],
      });
      const validRows = rows.filter((row) => row.pull_request_id !== null);
      if (validRows.length < rows.length) {
        this.log.warn(
          { fn: 'QueueOrderRepositoryImpl.readEffectiveOrder', total: rows.length, valid: validRows.length },
          'Filtered out rows with null pull_request_id',
        );
      }
      this.log.debug({ fn: 'QueueOrderRepositoryImpl.readEffectiveOrder', count: validRows.length }, 'Fetched effective order');
      return validRows.map((row) => this.mapper.fromReviewQueue(row));
    });
  }

  moveItems(queueItemUuids: string[], direction: MoveDirection): Promise<QueueItem[]> {
    return this.enforceTx(undefined, async (tx) => {
      const ordered = await this.readEffectiveOrder(tx);
      const orderedIds = ordered.map((item) => item.id);
      const selectedIds = resolveUuidsToIds(ordered, [...new Set(queueItemUuids)]);

      const idToStatus = new Map(ordered.map((item) => [item.id, item.status]));
      const pendingSelectedIds = selectedIds.filter((id) => idToStatus.get(id) === QueueStatus.pending);
      const skippedRetriggered = selectedIds.length - pendingSelectedIds.length;
      if (skippedRetriggered > 0) {
        this.log.debug({ fn: 'QueueOrderRepositoryImpl.moveItems', skipped: skippedRetriggered }, 'Skipped retriggered items in moveItems');
      }
      if (pendingSelectedIds.length === 0) {
        this.log.debug({ fn: 'QueueOrderRepositoryImpl.moveItems' }, 'No pending items to move; returning effective order unchanged');
        return ordered;
      }

      const sortedSelected = pendingSelectedIds.sort((a, b) => orderedIds.indexOf(a) - orderedIds.indexOf(b));
      if (direction === 'down') {
        sortedSelected.reverse();
      }

      const newOrder = [...orderedIds];
      for (const id of sortedSelected) {
        const idx = newOrder.indexOf(id);

        const neighborIdx = direction === 'up' ? idx - 1 : idx + 1;
        if (neighborIdx < 0 || neighborIdx >= newOrder.length) continue;
        if (pendingSelectedIds.includes(newOrder[neighborIdx])) continue;

        [newOrder[idx], newOrder[neighborIdx]] = [newOrder[neighborIdx], newOrder[idx]];
      }

      await this.normalizePositionsToOrder(tx, newOrder);

      this.log.debug({ fn: 'QueueOrderRepositoryImpl.moveItems', ids: queueItemUuids, direction }, 'Moved items in queue order');

      return this.readEffectiveOrder(tx);
    });
  }

  moveToTop(uuid: string): Promise<QueueItem> {
    return this.enforceTx(undefined, async (tx) => {
      const rawItem = await tx.reviewQueue.findUnique({
        where: { uuid },
        select: { id: true, status: true },
      });

      if (!rawItem) {
        throw new PrismaRecordNotFoundError({
          tableName: 'reviewQueue',
          functionName: 'QueueOrderRepositoryImpl.moveToTop',
          details: { uuid },
        });
      }

      if (rawItem.status === QueueStatus.resolved) {
        throw new RabbitMaximizerError({
          code: RabbitMaximizerErrorCodes.QUEUE_ITEM_NOT_PENDING,
          message: `Queue item ${uuid} is already resolved`,
          functionName: 'QueueOrderRepositoryImpl.moveToTop',
          details: { uuid, status: rawItem.status },
        });
      }

      if (rawItem.status === QueueStatus.retriggered) {
        throw new RabbitMaximizerError({
          code: RabbitMaximizerErrorCodes.QUEUE_ITEM_NOT_PENDING,
          message: `Queue item ${uuid} is in cooldown and cannot be moved to top`,
          functionName: 'QueueOrderRepositoryImpl.moveToTop',
          details: { uuid, status: rawItem.status },
        });
      }

      const ordered = await this.readEffectiveOrder(tx);
      const item = findByUuid(ordered, uuid);

      if (!item) {
        throw new PrismaRecordNotFoundError({
          tableName: 'reviewQueue',
          functionName: 'QueueOrderRepositoryImpl.moveToTop',
          details: { uuid },
        });
      }

      const numericId = item.id;

      const orderedIds = ordered.map((i) => i.id);
      const newOrder = [numericId, ...orderedIds.filter((oid) => oid !== numericId)];
      await this.normalizePositionsToOrder(tx, newOrder);

      this.log.debug({ fn: 'QueueOrderRepositoryImpl.moveToTop', uuid }, 'Moved item to top');

      const updatedList = await this.readEffectiveOrder(tx);
      return updatedList.find((i) => i.uuid === uuid)!;
    });
  }

  private async normalizePositionsToOrder(db: Prisma.TransactionClient, orderedIds: number[]): Promise<void> {
    const activeItems = await db.reviewQueue.findMany({
      where: { status: { in: [...EFFECTIVE_ORDER_STATUSES] } },
      include: { queueOrder: true },
    });

    const qoIds = activeItems.map((item) => item.queueOrder?.id).filter((id): id is number => id != null);
    if (qoIds.length > 0) {
      await db.queueOrder.updateMany({
        where: { id: { in: qoIds } },
        data: { position: null },
      });
    }

    // Assign new positions, creating queue_order rows for items that lack them (pre-migration backfill)
    const itemById = new Map(activeItems.map((item) => [item.id, item]));
    for (let i = 0; i < orderedIds.length; i++) {
      const item = itemById.get(orderedIds[i]);
      /* c8 ignore next 2 — defensive: orderedIds are derived from readEffectiveOrder which returns active items */
      if (!item) continue;

      if (item.queueOrder) {
        await this.withPrismaErrorHandling(
          () =>
            db.queueOrder.update({
              where: { id: item.queueOrder!.id },
              data: { position: i + 1 },
            }),
          'QueueOrderRepositoryImpl.normalizePositionsToOrder',
        );
      } else {
        await db.queueOrder.create({
          data: { queue_item_id: orderedIds[i], position: i + 1 },
        });
      }
    }

    this.log.debug({ fn: 'QueueOrderRepositoryImpl.normalizePositionsToOrder', count: orderedIds.length }, 'Normalized queue positions');
  }
}
