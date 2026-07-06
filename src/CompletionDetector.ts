import type { EventRepository } from './db/eventRepository.js';
import type { QueueRepository } from './db/queueRepository.js';
import type { CoderabbitGitHubClient } from './github/coderabbitGitHubClient.js';
import { splitRepo } from './github/splitRepo.js';
import type { ObservationContextProvider } from './observability/observationContext.js';
import { EventType } from './types/index.js';
import { MS_PER_SECOND } from './utils/durations.js';
import type { Config } from './config.js';
import { IntervalService } from './IntervalService.js';
import { TYPES } from './inversify-types.js';

import type { Logger } from '@couimet/logger-contract';
import type { PrismaClient } from '@prisma/client';
import { inject, injectable } from 'inversify';

@injectable()
export class CompletionDetector extends IntervalService {
  /* c8 ignore start — decorator emit branches */
  constructor(
    @inject(TYPES.QueueRepository)
    private readonly queue: QueueRepository,
    @inject(TYPES.CoderabbitGitHubClient)
    private readonly github: CoderabbitGitHubClient,
    @inject(TYPES.EventRepository)
    private readonly events: EventRepository,
    @inject(TYPES.PrismaClient)
    private readonly prisma: PrismaClient,
    @inject(TYPES.ObservationContextProvider)
    private readonly observation: ObservationContextProvider,
    @inject(TYPES.Config) cfg: Config,
    @inject(TYPES.Logger) log: Logger,
  ) {
    super(log, cfg.POLL_INTERVAL * MS_PER_SECOND);
  }
  /* c8 ignore stop */

  protected onStart(): void {
    this.log.info({ fn: 'CompletionDetector.start', pollIntervalSec: this.intervalMs / MS_PER_SECOND }, 'Starting completion detector');
  }

  protected onStop(): void {
    this.log.info({ fn: 'CompletionDetector.stop' }, 'Completion detector stopped');
  }

  protected async executeTick(): Promise<void> {
    const postedItems = await this.queue.getPostedQueue();
    if (postedItems.length === 0) return;

    for (const item of postedItems) {
      try {
        if (item.posted_at == null) continue;

        const { owner, repo } = splitRepo(item.repo_full_name);
        const completedReview = await this.github.findCompletedReview(owner, repo, item.pr_number, item.posted_at);

        if (!completedReview) continue;

        const obs = this.observation.current();

        await this.prisma.$transaction(async (tx) => {
          await this.queue.markCompleted(item.id, tx);

          await this.events.record(
            {
              type: EventType.completed,
              repo_full_name: item.repo_full_name,
              pr_number: item.pr_number,
              correlation_id: obs.correlationId,
              request_id: obs.requestId,
              version: obs.version,
              payload: {
                posted_comment_url: completedReview.htmlUrl,
              },
            },
            tx,
          );
        });

        this.log.info(
          {
            fn: 'CompletionDetector.tick',
            repo: item.repo_full_name,
            pr: item.pr_number,
            queueId: item.id,
          },
          'Completed review detected',
        );
      } catch (err: unknown) {
        this.log.warn({ fn: 'CompletionDetector.tick', error: err }, 'Completion detection tick failed; will retry on next interval');
      }
    }
  }
}
