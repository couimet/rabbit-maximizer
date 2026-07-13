import type { PullRequestRepository } from './db/pullRequestRepository.js';
import type { QueueRepository } from './db/queueRepository.js';
import type { PRStateFetcher } from './github/PRStateFetcher.js';
import { isPRClosedWithoutMerge, isPRMerged } from './github/prStateUtils.js';
import type { ObservationContextProvider } from './observability/observationContext.js';
import type { ProbeFactory } from './probes/ProbeFactory.js';
import { type OnDetectedCallback } from './types/index.js';
import { TYPES } from './inversify-types.js';

import { type PrismaClient } from '@prisma/client';
import { inject, injectable } from 'inversify';

const MILLISECONDS_PER_SECOND = 1000;

@injectable()
export class EnqueueService {
  /* c8 ignore start — decorator emit branches */
  constructor(
    @inject(TYPES.QueueRepository)
    private readonly queue: QueueRepository,
    @inject(TYPES.PullRequestRepository)
    private readonly pullRequests: PullRequestRepository,
    @inject(TYPES.PrismaClient)
    private readonly prisma: PrismaClient,
    @inject(TYPES.ProbeFactory)
    private readonly probes: ProbeFactory,
    @inject(TYPES.ObservationContextProvider)
    private readonly observation: ObservationContextProvider,
    @inject(TYPES.PRStateFetcher)
    private readonly fetcher: PRStateFetcher,
  ) {}
  /* c8 ignore stop */

  readonly handle: OnDetectedCallback = async (comment, waitSeconds) => {
    const scheduledFor = new Date(new Date(comment.updated_at).getTime() + waitSeconds * MILLISECONDS_PER_SECOND);
    const obs = this.observation.current();

    const probe = this.probes.createDetectedProbe(
      {
        repo_full_name: comment.repo_full_name,
        pr_number: comment.pr_number,
        source_ts: new Date(comment.created_at),
        source_comment_url: comment.url,
      },
      obs,
    );
    await probe.detected();

    const prState = await this.fetcher.fetch(comment.repo_full_name, comment.pr_number, 'EnqueueService.handle');

    await this.prisma.$transaction(async (tx) => {
      if (prState !== undefined && isPRMerged(prState)) {
        await probe.prMerged(tx);
      } else if (prState !== undefined && isPRClosedWithoutMerge(prState)) {
        await probe.prClosedWithoutMerge(tx);
      } else {
        const { id: pullRequestId } = await this.pullRequests.upsert(
          comment.repo_full_name,
          comment.pr_number,
          { prTitle: comment.pr_title, reviewLimitAt: new Date() },
          tx,
        );
        const { created } = await this.queue.enqueue(
          {
            repo: comment.repo_full_name,
            pr: comment.pr_number,
            prTitle: comment.pr_title,
            notBefore: scheduledFor,
            sourceCommentUrl: comment.url,
            sourceCommentId: comment.comment_id,
            newWait: waitSeconds,
            pullRequestId,
          },
          obs,
          tx,
        );
        if (created) {
          await probe.enqueued(tx);
        } else {
          probe.alreadyQueued();
        }
      }
    });
  };
}
