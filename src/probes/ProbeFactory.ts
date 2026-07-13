import type { EventRepository } from '../db/eventRepository.js';
import type { PullRequestRepository } from '../db/pullRequestRepository.js';
import type { QueueRepository } from '../db/queueRepository.js';
import { TYPES } from '../inversify-types.js';
import type { ObservationContext, ObservationContextProvider } from '../observability/observationContext.js';
import type { QueueItem } from '../types/index.js';

import { DetectedProbe, type DetectedProbeContext } from './DetectedProbe.js';
import { MarkQueueItemReviewedProbe } from './MarkQueueItemReviewedProbe.js';
import { QueueItemProbe } from './QueueItemProbe.js';
import { ReviewRetriggerProbe } from './ReviewRetriggerProbe.js';

import type { Logger } from '@couimet/logger-contract';
import { inject, injectable } from 'inversify';

@injectable()
export class ProbeFactory {
  /* c8 ignore start — decorator emit branches */
  constructor(
    @inject(TYPES.EventRepository)
    private readonly eventRepository: EventRepository,
    @inject(TYPES.PullRequestRepository)
    private readonly pullRequests: PullRequestRepository,
    @inject(TYPES.ObservationContextProvider)
    private readonly observation: ObservationContextProvider,
    @inject(TYPES.Logger) private readonly log: Logger,
  ) {}
  /* c8 ignore stop */

  createDetectedProbe(context: DetectedProbeContext, observation: ObservationContext): DetectedProbe {
    return new DetectedProbe(context, this.eventRepository, observation, this.log);
  }

  // TODO [2026-07-15]: #123 — move queue back to constructor once circular dep dissolves
  createQueueItemProbe(item: QueueItem, observation: ObservationContext, queue: QueueRepository): QueueItemProbe {
    return new QueueItemProbe(item, queue, this.pullRequests, this.eventRepository, observation, this.log);
  }

  createMarkQueueItemReviewedProbe(uuid: string): MarkQueueItemReviewedProbe {
    return new MarkQueueItemReviewedProbe(uuid, this.eventRepository, this.observation.current(), this.log);
  }

  /* c8 ignore start — wiring: no logic to test; constructor delegation only */
  // TODO [2026-07-15]: #123 — move queue back to constructor once circular dep dissolves
  createReviewRetriggerProbe(item: QueueItem, queue: QueueRepository): ReviewRetriggerProbe {
    return new ReviewRetriggerProbe(item, queue, this.pullRequests, this.eventRepository, this.observation.current(), this.log);
  }
  /* c8 ignore stop */
}
