import type { QueueRepository } from './db/queueRepository.js';
import type { CoderabbitGitHubClient } from './github/coderabbitGitHubClient.js';
import { splitRepo } from './github/splitRepo.js';
import type { ProbeFactory } from './probes/ProbeFactory.js';
import { MS_PER_SECOND } from './utils/durations.js';
import type { Config } from './config.js';
import { IntervalService } from './IntervalService.js';
import { TYPES } from './inversify-types.js';

import type { Logger } from '@couimet/logger-contract';
import type { PrismaClient } from '@prisma/client';
import { inject, injectable } from 'inversify';

@injectable()
export class ReviewDetector extends IntervalService {
  /* c8 ignore start */
  constructor(
    @inject(TYPES.QueueRepository) private readonly queue: QueueRepository,
    @inject(TYPES.CoderabbitGitHubClient) private readonly github: CoderabbitGitHubClient,
    @inject(TYPES.ProbeFactory) private readonly probeFactory: ProbeFactory,
    @inject(TYPES.PrismaClient) private readonly prisma: PrismaClient,
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
    const probe = this.probeFactory.createReviewDetectorProbe();
    const retriggeredItems = await this.queue.getRetriggeredQueue();
    if (retriggeredItems.length === 0) {
      probe.noRetriggeredItemFound();
      return;
    }
    for (const item of retriggeredItems) {
      probe.withItem(item);
      try {
        if (item.retriggered_at == null) continue;
        const { owner, repo } = splitRepo(item.repo_full_name);
        const completedReview = await this.github.findCompletedReview(owner, repo, item.pr_number, item.retriggered_at);
        if (!completedReview) {
          probe.noCompletedReviewFound();
          continue;
        }
        await this.prisma.$transaction(async (tx) => {
          await this.queue.markReviewed(item.id, tx);
          await probe.completed(completedReview, tx);
        });
      } catch (err: unknown) {
        probe.caughtError(err);
      }
    }
  }
}
