import type { EventRepository } from './db/eventRepository.js';
import type { QueueOrderRepository } from './db/queueOrderRepository.js';
import type { QueueRepository } from './db/queueRepository.js';
import { RabbitMaximizerError } from './errors/RabbitMaximizerError.js';
import type { CoderabbitGitHubClient } from './github/coderabbitGitHubClient.js';
import type { ObservationContextProvider } from './observability/observationContext.js';
import { EventType, type QueueItem } from './types/index.js';
import { computeSchedulerBackoff, MS_PER_SECOND } from './utils/index.js';
import type { Config } from './config.js';
import { IntervalService } from './IntervalService.js';
import { TYPES } from './inversify-types.js';
import type { Pruner } from './Pruner.js';
import type { SourceCommentValidator } from './SourceCommentValidator.js';

import type { Logger } from '@couimet/logger-contract';
import { type PrismaClient } from '@prisma/client';
import { StatusCodes } from 'http-status-codes';
import { inject, injectable } from 'inversify';
import { randomUUID } from 'node:crypto';

const TERMINAL_HTTP_STATUSES = [StatusCodes.NOT_FOUND, StatusCodes.GONE];

@injectable()
export class Scheduler extends IntervalService {
  private readonly postCooldownMs: number;
  private readonly baseBackoff: number;
  private readonly maxBackoff: number;

  /* c8 ignore start — decorator emit branches */
  constructor(
    @inject(TYPES.QueueRepository)
    private readonly queue: QueueRepository,
    @inject(TYPES.QueueOrderRepository)
    private readonly queueOrder: QueueOrderRepository,
    @inject(TYPES.CoderabbitGitHubClient)
    private readonly github: CoderabbitGitHubClient,
    @inject(TYPES.EventRepository)
    private readonly events: EventRepository,
    @inject(TYPES.ObservationContextProvider)
    private readonly observation: ObservationContextProvider,
    @inject(TYPES.PrismaClient)
    private readonly prisma: PrismaClient,
    @inject(TYPES.Config) cfg: Config,
    @inject(TYPES.Pruner)
    private readonly pruner: Pruner,
    @inject(TYPES.SourceCommentValidator)
    private readonly commentValidator: SourceCommentValidator,
    @inject(TYPES.Logger) log: Logger,
  ) {
    super(log, cfg.SCHEDULER_TICK_INTERVAL_MS);
    this.postCooldownMs = cfg.SCHEDULER_POST_COOLDOWN * MS_PER_SECOND;
    this.baseBackoff = cfg.SCHEDULER_RETRY_BACKOFF_BASE * MS_PER_SECOND;
    this.maxBackoff = cfg.SCHEDULER_RETRY_BACKOFF_MAX * MS_PER_SECOND;
  }
  /* c8 ignore stop */

  protected onStart(): void {
    this.log.info({ fn: 'Scheduler.start', tickIntervalMs: this.intervalMs }, 'Starting scheduler');
  }

  protected onStop(): void {
    this.log.info({ fn: 'Scheduler.stop' }, 'Scheduler stopped');
  }

  protected async executeTick(): Promise<void> {
    let item: QueueItem | undefined;
    try {
      await this.pruner.prune();

      const eligible = await this.queueOrder.getEffectiveOrder();
      item = eligible[0];
      if (!item) return;

      const item_ = item;
      const runId = randomUUID();

      const outcome = await this.commentValidator.validate(item_);

      switch (outcome.action) {
        case 'reschedule': {
          await this.prisma.$transaction(async (tx) => {
            await this.queue.reschedule(item_.id, outcome.notBefore, outcome.sourceComment, tx);
          });
          this.log.info(
            { fn: 'Scheduler.tick', repo: item_.repo_full_name, pr: item_.pr_number, queueId: item_.id, newNotBefore: outcome.notBefore },
            'Stale source comment replaced; rescheduled with updated not_before',
          );
          return;
        }
        case 'skip': {
          const backoffMs = computeSchedulerBackoff(item_.attempts, this.baseBackoff, this.maxBackoff);
          await this.prisma.$transaction(async (tx) => {
            await this.queue.backoff(item_.id, new Date(Date.now() + backoffMs), tx);
          });
          this.log.warn(
            { fn: 'Scheduler.tick', repo: item_.repo_full_name, pr: item_.pr_number, queueId: item_.id, backoffMs },
            'Stale source comment with no replacement; rescheduled with backoff',
          );
          return;
        }
        case 'proceed':
          break;
        /* c8 ignore next 3 — unreachable: every ValidationOutcome action is explicitly handled */
        default:
          throw RabbitMaximizerError.forUnexpectedSwitchDefault('ValidationOutcome.action', (outcome as { action: string }).action, 'Scheduler.executeTick');
      }

      const { htmlUrl: retriggeredCommentUrl } = await this.github.postRetrigger(
        item_.repo_full_name,
        item_.pr_number,
        item_.source_comment_url,
        runId,
        item_.trigger_source,
      );

      const obs = this.observation.current();

      await this.prisma.$transaction(async (tx) => {
        await this.queue.markRetriggered(item_.id, new Date(Date.now() + this.postCooldownMs), tx);

        await this.events.record(
          {
            type: EventType.retriggered,
            repo_full_name: item_.repo_full_name,
            pr_number: item_.pr_number,
            correlation_id: obs.correlationId,
            request_id: obs.requestId,
            version: obs.version,
            payload: {
              source_comment_url: item_.source_comment_url,
              retriggered_comment_url: retriggeredCommentUrl,
            },
          },
          tx,
        );
      });

      this.log.info({ fn: 'Scheduler.tick', repo: item_.repo_full_name, pr: item_.pr_number, queueId: item_.id, runId }, 'Retrigger retriggered');
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

      const backoffMs = computeSchedulerBackoff(item.attempts, this.baseBackoff, this.maxBackoff);

      await this.prisma.$transaction(async (tx) => {
        await this.queue.backoff(item!.id, new Date(Date.now() + backoffMs), tx);
      });

      this.log.warn(
        {
          fn: 'Scheduler.tick',
          repo: item.repo_full_name,
          pr: item.pr_number,
          queueId: item.id,
          backoffMs,
          attempts: item.attempts,
          error: err,
        },
        'Post retrigger failed; rescheduled with backoff',
      );
    }
  }
}
