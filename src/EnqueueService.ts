import type { QueueRepository } from './db/queueRepository.js';
import type { ObservationContextProvider } from './observability/observationContext.js';
import type { ProbeFactory } from './probes/ProbeFactory.js';
import type { OnDetectedCallback } from './types/index.js';
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
    @inject(TYPES.PrismaClient)
    private readonly prisma: PrismaClient,
    @inject(TYPES.ProbeFactory)
    private readonly probes: ProbeFactory,
    @inject(TYPES.ObservationContextProvider)
    private readonly observation: ObservationContextProvider,
  ) {}
  /* c8 ignore stop */

  readonly handle: OnDetectedCallback = async (comment, jitteredWait) => {
    const scheduledFor = new Date(Date.now() + jitteredWait * MILLISECONDS_PER_SECOND);
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
    await probe.processStarted();

    await this.prisma.$transaction(async (tx) => {
      await this.queue.enqueue(comment.repo_full_name, comment.pr_number, scheduledFor, comment.url, jitteredWait, obs, tx);
      await probe.processCompleted(tx);
    });
  };
}
