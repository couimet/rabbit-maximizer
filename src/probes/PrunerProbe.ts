import type { EventRepository } from '../db/eventRepository.js';
import type { ObservationContext } from '../observability/observationContext.js';
import { BypassReason, type QueueItem } from '../types/index.js';

import { recordBypassEvent } from './recordBypassEvent.js';

import type { Logger } from '@couimet/logger-contract';
import type { Prisma } from '@prisma/client';

export class PrunerProbe {
  private item: QueueItem | undefined;

  constructor(
    private readonly events: EventRepository,
    private readonly observation: ObservationContext,
    private readonly log: Logger,
  ) {}

  withItem(item: QueueItem): void {
    this.item = item;
  }

  noItemsToPrune(): void {
    this.log.info({ fn: 'PrunerProbe.noItemsToPrune' }, 'No items to prune');
  }

  async prMerged(tx: Prisma.TransactionClient): Promise<void> {
    await recordBypassEvent({
      events: this.events,
      tx,
      reason: BypassReason.prMerged,
      observation: this.observation,
      repo_full_name: this.item!.repo_full_name,
      pr_number: this.item!.pr_number,
    });
    this.log.info(
      { fn: 'PrunerProbe.prMerged', repo: this.item!.repo_full_name, pr: this.item!.pr_number, queueId: this.item!.id },
      'Merged before retrigger; marked reviewed',
    );
  }

  async prClosedWithoutMerge(tx: Prisma.TransactionClient): Promise<void> {
    await recordBypassEvent({
      events: this.events,
      tx,
      reason: BypassReason.prClosedWithoutMerge,
      observation: this.observation,
      repo_full_name: this.item!.repo_full_name,
      pr_number: this.item!.pr_number,
    });
    this.log.info(
      { fn: 'PrunerProbe.prClosedWithoutMerge', repo: this.item!.repo_full_name, pr: this.item!.pr_number, queueId: this.item!.id },
      'PR closed before retrigger; marked failed',
    );
  }

  caughtError(err: unknown): void {
    this.log.warn(
      { fn: 'PrunerProbe.caughtError', repo: this.item!.repo_full_name, pr: this.item!.pr_number, queueId: this.item!.id, error: err },
      'Failed to prune item; continuing',
    );
  }
}
