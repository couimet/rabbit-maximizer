import type { EventRepository } from './db/eventRepository.js';
import type { QueueRepository } from './db/queueRepository.js';
import { RabbitMaximizerError } from './errors/RabbitMaximizerError.js';
import { RabbitMaximizerErrorCodes } from './errors/RabbitMaximizerErrorCodes.js';
import type { CoderabbitGitHubClient } from './github/coderabbitGitHubClient.js';
import type { ObservationContextProvider } from './observability/observationContext.js';
import { EventType } from './types/EventType.js';
import { TYPES } from './inversify-types.js';

import type { Logger } from '@couimet/logger-contract';
import { type PrismaClient } from '@prisma/client';
import { inject, injectable } from 'inversify';
import { randomUUID } from 'node:crypto';

const TICK_INTERVAL_MS = 10_000;
const HTTP_FORBIDDEN = 403;
const HTTP_NOT_FOUND = 404;
const HTTP_GONE = 410;

const TERMINAL_HTTP_STATUSES = [HTTP_FORBIDDEN, HTTP_NOT_FOUND, HTTP_GONE];

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
    let item: Awaited<ReturnType<typeof this.queue.getNextDue>> | null = null;
    try {
      item = await this.queue.getNextDue();
      if (!item) return;

      const runId = randomUUID();

      if (item.source_comment_url == null) {
        throw new RabbitMaximizerError({
          code: RabbitMaximizerErrorCodes.MISSING_SOURCE_COMMENT_URL,
          functionName: 'Scheduler.executeTick',
          message: 'source_comment_url is required but was null or undefined',
          details: { queueItemId: item.id, repo: item.repo_full_name, pr: item.pr_number },
        });
      }

      const sourceCommentUrl: string = item.source_comment_url;

      const { htmlUrl: postedCommentUrl } = await this.github.postRetrigger(item.repo_full_name, item.pr_number, sourceCommentUrl, runId);

      const obs = this.observation.current();

      await this.prisma.$transaction(async (tx) => {
        await this.queue.markPosted(item!.id, tx);

        await this.events.record(
          {
            type: EventType.posted,
            repo_full_name: item!.repo_full_name,
            pr_number: item!.pr_number,
            correlation_id: obs.correlationId,
            request_id: obs.requestId,
            version: obs.version,
            payload: {
              source_comment_url: sourceCommentUrl,
              posted_comment_url: postedCommentUrl,
            },
          },
          tx,
        );
      });

      this.log.info(
        {
          fn: 'Scheduler.tick',
          repo: item!.repo_full_name,
          pr: item!.pr_number,
          queueId: item!.id,
          runId,
        },
        'Retrigger posted',
      );
    } catch (err: unknown) {
      if (!item) {
        this.log.warn({ fn: 'Scheduler.tick', error: err }, 'executeTick failed before item was fetched');
        return;
      }

      const error = err as { status?: number };

      if (error.status !== undefined && TERMINAL_HTTP_STATUSES.includes(error.status)) {
        const obs = this.observation.current();
        const item_ = item;

        await this.prisma.$transaction(async (tx) => {
          await this.queue.markFailed(item_.id, tx);

          await this.events.record(
            {
              type: EventType.failed,
              repo_full_name: item_.repo_full_name,
              pr_number: item_.pr_number,
              correlation_id: obs.correlationId,
              request_id: obs.requestId,
              version: obs.version,
              payload: {
                reason: error.status === HTTP_FORBIDDEN ? 'Access denied or PR unavailable' : 'PR closed or merged',
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
          error.status === HTTP_FORBIDDEN ? 'Access denied or PR unavailable; marked failed' : 'PR closed or merged; marked failed',
        );
        return;
      }

      this.log.warn(
        {
          fn: 'Scheduler.tick',
          repo: item.repo_full_name,
          pr: item.pr_number,
          queueId: item.id,
          error: err,
        },
        'Post retrigger failed; will retry next tick',
      );
    }
  }
}
