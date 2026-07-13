import type { EventRepository } from '../db/eventRepository.js';
import { TYPES } from '../inversify-types.js';
import type { ObservationContext, ObservationContextProvider } from '../observability/observationContext.js';
import type { QueueItem } from '../types/index.js';

import { DetectedProbe, type DetectedProbeContext } from './DetectedProbe.js';
import { EnqueueProbe } from './EnqueueProbe.js';
import { MarkQueueItemReviewedProbe } from './MarkQueueItemReviewedProbe.js';
import { PrunerProbe } from './PrunerProbe.js';
import { ReviewDetectorProbe } from './ReviewDetectorProbe.js';
import { ReviewRetriggerProbe } from './ReviewRetriggerProbe.js';
import { type CreateSchedulerProbeParams, SchedulerProbe } from './SchedulerProbe.js';

import type { Logger } from '@couimet/logger-contract';
import type { Prisma } from '@prisma/client';
import { inject, injectable } from 'inversify';

@injectable()
export class ProbeFactory {
  /* c8 ignore start — decorator emit branches */
  constructor(
    @inject(TYPES.EventRepository) private readonly eventRepository: EventRepository,
    @inject(TYPES.ObservationContextProvider) private readonly observation: ObservationContextProvider,
    @inject(TYPES.Logger) private readonly log: Logger,
  ) {}
  /* c8 ignore stop */

  // C011 exception: same ObservationContext must be shared with queue.enqueue() in EnqueueService.handle
  // This is the only factory method that accepts ObservationContext directly.
  createDetectedProbe(context: DetectedProbeContext, observation: ObservationContext): DetectedProbe {
    return new DetectedProbe(context, this.eventRepository, observation, this.log);
  }

  createPrunerProbe(): PrunerProbe {
    return new PrunerProbe(this.eventRepository, this.observation.current(), this.log);
  }

  createMarkQueueItemReviewedProbe(uuid: string): MarkQueueItemReviewedProbe {
    return new MarkQueueItemReviewedProbe(uuid, this.eventRepository, this.observation.current(), this.log);
  }

  createEnqueueProbe(tx: Prisma.TransactionClient): EnqueueProbe {
    return new EnqueueProbe(this.eventRepository, this.observation.current(), tx, this.log);
  }

  createSchedulerProbe(params: CreateSchedulerProbeParams): SchedulerProbe {
    return new SchedulerProbe(params.baseBackoff, params.maxBackoff, this.eventRepository, this.observation.current(), this.log);
  }

  createReviewRetriggerProbe(item: QueueItem): ReviewRetriggerProbe {
    return new ReviewRetriggerProbe(item, this.eventRepository, this.observation.current(), this.log);
  }

  createReviewDetectorProbe(): ReviewDetectorProbe {
    return new ReviewDetectorProbe(this.eventRepository, this.observation.current(), this.log);
  }
}
