import { RabbitMaximizerError } from '../errors/RabbitMaximizerError.js';
import { RabbitMaximizerErrorCodes } from '../errors/RabbitMaximizerErrorCodes.js';
import { TYPES } from '../inversify-types.js';
import { type QueueItem, QueueStatus, TriggerSource } from '../types/index.js';
import { findByUuid, resolveUuidsToIds } from '../utils/uuidLookup.js';

import { BasePrismaRepository } from './BasePrismaRepository.js';

import type { Logger } from '@couimet/logger-contract';
import { Prisma, type PrismaClient, type QueueOrder, type ReviewQueue } from '@prisma/client';
import { inject, injectable } from 'inversify';

export type MoveDirection = 'up' | 'down';

export interface QueueOrderRepository {
  getEffectiveOrder(options?: { eligibleOnly?: boolean; includeRetriggered?: boolean }): Promise<QueueItem[]>;
  moveItems(queueItemUuids: string[], direction: MoveDirection): Promise<QueueItem[]>;
  moveToTop(uuid: string): Promise<QueueItem>;
}

@injectable()
export class QueueOrderRepositoryImpl extends BasePrismaRepository implements QueueOrderRepository {
  constructor(@inject(TYPES.PrismaClient) prisma: PrismaClient, @inject(TYPES.Logger) log: Logger) {
    super(prisma, log);
  }

  getEffectiveOrder(options?: { eligibleOnly?: boolean; includeRetriggered?: boolean }): Promise<QueueItem[]> {
    return this.readEffectiveOrder(undefined, options?.eligibleOnly ?? true, options?.includeRetriggered ?? false);
  }

  private async readEffectiveOrder(tx?: Prisma.TransactionClient, eligibleOnly = true, includeRetriggered = false): Promise<QueueItem[]> {
    const db = this.client(tx);
    const statuses = includeRetriggered ? ['pending', 'retriggered'] : ['pending'];
    const where: Prisma.ReviewQueueWhereInput = { status: { in: statuses } };
    if (eligibleOnly) {
      where.not_before = { lte: new Date() };
    }
    const rows = await db.reviewQueue.findMany({
      where,
      include: { queueOrder: true, pullRequest: { select: { author_login: true } } },
      orderBy: [{ queueOrder: { position: { sort: 'asc', nulls: 'last' } } }, { queueOrder: { id: 'asc' } }],
    });
    const validRows = rows.filter((row) => row.pull_request_id !== null);
    if (validRows.length < rows.length) {
      this.log.warn(
        { fn: 'QueueOrderRepositoryImpl.readEffectiveOrder', total: rows.length, valid: validRows.length },
        'Filtered out rows with null pull_request_id',
      );
    }
    this.log.debug({ fn: 'QueueOrderRepositoryImpl.readEffectiveOrder', count: validRows.length, eligibleOnly }, 'Fetched effective order');
    return validRows.map((row) => this.toQueueItem(row));
  }

  moveItems(queueItemUuids: string[], direction: MoveDirection): Promise<QueueItem[]> {
    return this.transaction(async (tx) => {
      const ordered = await this.readEffectiveOrder(tx, false, true);
      const orderedIds = ordered.map((item) => item.id);
      const selectedIds = resolveUuidsToIds(ordered, [...new Set(queueItemUuids)]);

      const sortedSelected = selectedIds.sort((a, b) => orderedIds.indexOf(a) - orderedIds.indexOf(b));
      if (direction === 'down') {
        sortedSelected.reverse();
      }

      const newOrder = [...orderedIds];
      for (const id of sortedSelected) {
        const idx = newOrder.indexOf(id);

        const neighborIdx = direction === 'up' ? idx - 1 : idx + 1;
        if (neighborIdx < 0 || neighborIdx >= newOrder.length) continue;
        if (selectedIds.includes(newOrder[neighborIdx])) continue;

        [newOrder[idx], newOrder[neighborIdx]] = [newOrder[neighborIdx], newOrder[idx]];
      }

      await this.normalizePositionsToOrder(tx, newOrder);

      this.log.debug({ fn: 'QueueOrderRepositoryImpl.moveItems', ids: queueItemUuids, direction }, 'Moved items in queue order');

      return this.readEffectiveOrder(tx, false, true);
    });
  }

  moveToTop(uuid: string): Promise<QueueItem> {
    return this.transaction(async (tx) => {
      const db = this.client(tx);
      const rawItem = await db.reviewQueue.findUnique({
        where: { uuid },
        select: { id: true, status: true },
      });

      if (!rawItem) {
        throw new RabbitMaximizerError({
          code: RabbitMaximizerErrorCodes.QUEUE_ITEM_NOT_FOUND,
          message: `Queue item ${uuid} not found`,
          functionName: 'QueueOrderRepositoryImpl.moveToTop',
          details: { uuid },
        });
      }

      const allowedStatuses: string[] = [QueueStatus.pending, QueueStatus.retriggered];
      if (!allowedStatuses.includes(rawItem.status)) {
        throw new RabbitMaximizerError({
          code: RabbitMaximizerErrorCodes.QUEUE_ITEM_NOT_PENDING,
          message: `Queue item ${uuid} is not pending or retriggered`,
          functionName: 'QueueOrderRepositoryImpl.moveToTop',
          details: { uuid, status: rawItem.status },
        });
      }

      const ordered = await this.readEffectiveOrder(tx, false, true);
      const item = findByUuid(ordered, uuid);

      if (!item) {
        throw new RabbitMaximizerError({
          code: RabbitMaximizerErrorCodes.QUEUE_ITEM_NOT_FOUND,
          message: `Queue item ${uuid} not found`,
          functionName: 'QueueOrderRepositoryImpl.moveToTop',
          details: { uuid },
        });
      }

      const numericId = item.id;

      const orderedIds = ordered.map((i) => i.id);
      const newOrder = [numericId, ...orderedIds.filter((oid) => oid !== numericId)];
      await this.normalizePositionsToOrder(tx, newOrder);

      this.log.debug({ fn: 'QueueOrderRepositoryImpl.moveToTop', uuid }, 'Moved item to top');

      const updatedList = await this.readEffectiveOrder(tx, false);
      return updatedList.find((i) => i.uuid === uuid)!;
    });
  }

  private async normalizePositionsToOrder(db: Prisma.TransactionClient, orderedIds: number[]): Promise<void> {
    const items = await db.reviewQueue.findMany({
      where: { status: { in: ['pending', 'retriggered'] } },
      include: { queueOrder: true },
    });

    const qoIds = items.map((item) => item.queueOrder?.id).filter((id): id is number => id != null);
    if (qoIds.length > 0) {
      await db.queueOrder.updateMany({
        where: { id: { in: qoIds } },
        data: { position: null },
      });
    }

    // Assign new positions, creating queue_order rows for items that lack them (pre-migration backfill)
    const itemById = new Map(items.map((item) => [item.id, item]));
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

  private toQueueItem(row: ReviewQueue & { queueOrder: QueueOrder | null; pullRequest?: { author_login: string } | null }): QueueItem {
    return {
      id: row.id,
      uuid: row.uuid,
      repo_full_name: row.repo_full_name,
      pr_number: row.pr_number,
      pr_title: row.pr_title,
      author_login: row.pullRequest?.author_login ?? '<unknown>',
      status: row.status as QueueStatus,
      not_before: row.not_before,
      attempts: row.attempts,
      source_comment_url: row.source_comment_url,
      source_comment_id: row.source_comment_id,
      trigger_source: row.trigger_source as TriggerSource,
      retriggered_at: row.retriggered_at ?? undefined,
      failed_at: row.failed_at ?? undefined,
      reviewed_at: row.reviewed_at ?? undefined,
      // Guaranteed non-null by the filter in readEffectiveOrder
      pull_request_id: row.pull_request_id!,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }
}
