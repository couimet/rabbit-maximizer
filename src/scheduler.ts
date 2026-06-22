import type { EventRepository } from './db/eventRepository.js';
import type { QueueRepository } from './db/queueRepository.js';
import type { CoderabbitGitHubClient } from './github/coderabbitGitHubClient.js';
import type { ObservationContextProvider } from './observability/observationContext.js';
import { TYPES } from './inversify-types.js';
import { EventType } from './types/EventType.js';

import type { Logger } from '@couimet/logger-contract';
import { type PrismaClient } from '@prisma/client';
import { inject, injectable } from 'inversify';
import { randomUUID } from 'node:crypto';

const TICK_INTERVAL_MS = 10_000;
const HTTP_NOT_FOUND = 404;
const HTTP_GONE = 410;

@injectable()
export class Scheduler {
  private intervalId: ReturnType<typeof setInterval> | undefined;
  private tickPromise: Promise<void> | null = null;
  private stopped = false;

  /* c8 ignore start — decorator emit branches */
  constructor(
    @inject(TYPES.QueueRepository)
    private readonly queue: QueueRepository,
    @inject(TYPES.CoderabbitGitHubClient)
    private readonly github: CoderabbitGitHubClient,
    @inject(TYPES.EventRepository)
    private readonly events: EventRepository,
    @inject(TYPES.ObservationContextProvider)
    private readonly observation: ObservationContextProvider,
    @inject(TYPES.PrismaClient)
    private readonly prisma: PrismaClient,
    @inject(TYPES.Logger) private readonly log: Logger,
  ) {}
  /* c8 ignore stop */

  start(): { stop(): Promise<void> } {
    this.log.info({ fn: 'Scheduler.start', tickIntervalMs: TICK_INTERVAL_MS }, 'Starting scheduler');

    this.tick();

    this.intervalId = setInterval(() => {
      this.tick();
    }, TICK_INTERVAL_MS);

    return { stop: () => this.stop() };
  }

  private async stop(): Promise<void> {
    this.stopped = true;
    if (this.intervalId !== undefined) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }
    if (this.tickPromise) {
      await this.tickPromise;
    }
    this.log.info({ fn: 'Scheduler.stop' }, 'Scheduler stopped');
  }

  private async tick(): Promise<void> {
    if (this.stopped || this.tickPromise) return;
    this.tickPromise = this.executeTick();
    try {
      await this.tickPromise;
    } finally {
      this.tickPromise = null;
    }
  }

  private async executeTick(): Promise<void> {
    const item = await this.queue.getNextDue();
    if (!item) return;

    const runId = randomUUID();

    try {
      const { htmlUrl: postedCommentUrl } = await this.github.postRetrigger(item.repo_full_name, item.pr_number, item.source_comment_url ?? '', runId);

      const obs = this.observation.current();

      await this.prisma.$transaction(async (tx) => {
        await this.queue.markPosted(item.id, tx);

        await this.events.record(
          {
            type: EventType.posted,
            repo_full_name: item.repo_full_name,
            pr_number: item.pr_number,
            correlation_id: obs.correlationId,
            request_id: obs.requestId,
            version: obs.version,
            payload: {
              source_comment_url: item.source_comment_url ?? '',
              posted_comment_url: postedCommentUrl,
            },
          },
          tx,
        );
      });

      this.log.info(
        {
          fn: 'Scheduler.tick',
          repo: item.repo_full_name,
          pr: item.pr_number,
          queueId: item.id,
          runId,
        },
        'Retrigger posted',
      );
    } catch (err: unknown) {
      const error = err as { status?: number };

      if (error.status === HTTP_NOT_FOUND || error.status === HTTP_GONE) {
        const obs = this.observation.current();

        await this.prisma.$transaction(async (tx) => {
          await this.queue.markFailed(item.id, tx);

          await this.events.record(
            {
              type: EventType.failed,
              repo_full_name: item.repo_full_name,
              pr_number: item.pr_number,
              correlation_id: obs.correlationId,
              request_id: obs.requestId,
              version: obs.version,
              payload: {
                reason: 'PR closed or merged',
              },
            },
            tx,
          );
        });

        this.log.info(
          {
            fn: 'Scheduler.tick',
            repo: item.repo_full_name,
            pr: item.pr_number,
            queueId: item.id,
            status: error.status,
          },
          'PR closed or merged; marked failed',
        );
        return;
      }

      this.log.warn(
        {
          fn: 'Scheduler.tick',
          repo: item.repo_full_name,
          pr: item.pr_number,
          queueId: item.id,
          error: err instanceof Error ? err.message : String(err),
        },
        'Post retrigger failed; will retry next tick',
      );
    }
  }
}
