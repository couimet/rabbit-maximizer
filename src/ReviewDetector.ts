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
export class ReviewDetector extends IntervalService {
  /* c8 ignore start — decorator emit branches */
  constructor(
    @inject(TYPES.QueueRepository)
    private readonly queue: QueueRepository,
    @inject(TYPES.CoderabbitGitHubClient)
    private readonly github: CoderabbitGitHubClient,
    // TODO [2026-07-15]: #123 — remove once completion event recording moves to a probe
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
    this.log.info({ fn: 'ReviewDetector.start', pollIntervalSec: this.intervalMs / MS_PER_SECOND }, 'Starting review detector');
  }

  protected onStop(): void {
    this.log.info({ fn: 'ReviewDetector.stop' }, 'Review detector stopped');
  }

  protected async executeTick(): Promise<void> {
    const retriggeredItems = await this.queue.getRetriggeredQueue();
    if (retriggeredItems.length === 0) return;

    for (const item of retriggeredItems) {
      try {
        if (item.retriggered_at == null) continue;

        const { owner, repo } = splitRepo(item.repo_full_name);
        const completedReview = await this.github.findCompletedReview(owner, repo, item.pr_number, item.retriggered_at);

        if (!completedReview) continue;

        const obs = this.observation.current();

        await this.prisma.$transaction(async (tx) => {
          await this.queue.markReviewed(item.id, tx);

          // TODO [2026-07-15]: #123 — CompletionProbe: wire existing DetectedProbe or create new probe to encapsulate event recording
          await this.events.record(
            {
              type: EventType.completed,
              repo_full_name: item.repo_full_name,
              pr_number: item.pr_number,
              correlation_id: obs.correlationId,
              request_id: obs.requestId,
              version: obs.version,
              payload: {
                retriggered_comment_url: completedReview.htmlUrl,
                review_id: completedReview.reviewId,
              },
            },
            tx,
          );
        });

        this.log.info(
          {
            fn: 'ReviewDetector.tick',
            repo: item.repo_full_name,
            pr: item.pr_number,
            queueId: item.id,
            reviewUrl: completedReview.htmlUrl,
            reviewId: completedReview.reviewId,
          },
          'Review detected',
        );
      } catch (err: unknown) {
        this.log.warn({ fn: 'ReviewDetector.tick', error: err }, 'Review detection tick failed; will retry on next interval');
      }
    }
  }
}
