import { TYPES } from '../inversify-types.js';
import { parseEventRow } from '../schemas/events.js';
import type {
  BypassedPayload,
  CoderabbitReviewApprovedPayload,
  CoderabbitReviewChangesRequestedPayload,
  DetectedPayload,
  EnqueuedPayload,
  EventMetadata,
  FailedPayload,
  RetriggeredPayload,
} from '../types/EventPayloads.js';
import { type EventLogEntry, EventType, type PaginatedResult } from '../types/index.js';

import type { Logger } from '@couimet/logger-contract';
import { type Prisma, type PrismaClient } from '@prisma/client';
import { inject, injectable } from 'inversify';

interface NewEventBase {
  readonly repo_full_name: string;
  readonly pr_number: number;
  readonly correlation_id: string;
  readonly request_id?: string;
  readonly version: string;
  readonly metadata?: EventMetadata;
}

export type NewEvent =
  | (NewEventBase & { type: EventType.detected; payload: DetectedPayload })
  | (NewEventBase & { type: EventType.enqueued; payload: EnqueuedPayload })
  | (NewEventBase & { type: EventType.retriggered; payload: RetriggeredPayload })
  | (NewEventBase & { type: EventType.bypassed; payload: BypassedPayload })
  | (NewEventBase & { type: EventType.coderabbit_review_approved; payload: CoderabbitReviewApprovedPayload })
  | (NewEventBase & { type: EventType.coderabbit_review_changes_requested; payload: CoderabbitReviewChangesRequestedPayload })
  | (NewEventBase & { type: EventType.failed; payload: FailedPayload });

export interface EventRepository {
  record(input: NewEvent, tx: Prisma.TransactionClient): Promise<EventLogEntry>;
  listForPr(repo: string, pr: number): Promise<EventLogEntry[]>;
  listRecent(skip: number, take: number): Promise<PaginatedResult<EventLogEntry>>;
  countByType(since: Date): Promise<Record<EventType, number>>;
}

@injectable()
export class EventRepositoryImpl implements EventRepository {
  /* c8 ignore start — decorator emit branches */
  constructor(
    @inject(TYPES.PrismaClient) private readonly prisma: PrismaClient,
    @inject(TYPES.Logger) private readonly log: Logger,
  ) {}
  /* c8 ignore stop */

  async record(input: NewEvent, tx: Prisma.TransactionClient): Promise<EventLogEntry> {
    const row = await tx.event.create({
      data: {
        type: input.type,
        repo_full_name: input.repo_full_name,
        pr_number: input.pr_number,
        correlation_id: input.correlation_id,
        request_id: input.request_id ?? null,
        version: input.version,
        payload: JSON.stringify(input.payload),
        metadata: input.metadata ? JSON.stringify(input.metadata) : null,
      },
    });

    const entry = parseEventRow(row);
    this.log.debug(
      {
        fn: 'EventRepositoryImpl.record',
        type: input.type,
        repo: input.repo_full_name,
        pr: input.pr_number,
      },
      'Event recorded',
    );
    return entry;
  }

  async listForPr(repo: string, pr: number): Promise<EventLogEntry[]> {
    const rows = await this.prisma.event.findMany({
      where: { repo_full_name: repo, pr_number: pr },
      orderBy: { ts: 'asc' },
    });

    this.log.debug({ fn: 'EventRepositoryImpl.listForPr', repo, pr, count: rows.length }, 'Listed events for PR');
    return rows.map((row) => parseEventRow(row));
  }

  async listRecent(skip: number, take: number): Promise<PaginatedResult<EventLogEntry>> {
    const [rows, total] = await Promise.all([this.prisma.event.findMany({ orderBy: { ts: 'desc' }, skip, take }), this.prisma.event.count()]);

    this.log.debug({ fn: 'EventRepositoryImpl.listRecent', count: rows.length, total }, 'Listed recent events');
    return { items: rows.map((row) => parseEventRow(row)), total };
  }

  async countByType(since: Date): Promise<Record<EventType, number>> {
    const rows = await this.prisma.event.groupBy({
      by: ['type'],
      where: { ts: { gte: since } },
      _count: { type: true },
    });

    const counts: Record<EventType, number> = {
      bypassed: 0,
      coderabbit_review_approved: 0,
      coderabbit_review_changes_requested: 0,
      coderabbit_review_skipped: 0,
      detected: 0,
      enqueued: 0,
      failed: 0,
      retriggered: 0,
    };
    for (const row of rows) {
      counts[row.type as EventType] = row._count.type;
    }

    this.log.debug({ fn: 'EventRepositoryImpl.countByType', counts }, 'Counted events by type');
    return counts;
  }
}
