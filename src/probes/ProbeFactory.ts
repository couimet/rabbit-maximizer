import type { EventRepository } from '../db/eventRepository.js';
import type { QueueRepository } from '../db/queueRepository.js';
import { TYPES } from '../inversify-types.js';
import type { ObservationContext, ObservationContextProvider } from '../observability/observationContext.js';
import type { QueueItem } from '../types/index.js';

import { DetectedProbe, type DetectedProbeContext } from './DetectedProbe.js';
import { MarkQueueItemCompletedProbe } from './MarkQueueItemCompletedProbe.js';
import { QueueItemProbe } from './QueueItemProbe.js';

import type { Logger } from '@couimet/logger-contract';
import { inject, injectable } from 'inversify';

@injectable()
export class ProbeFactory {
  /* c8 ignore start — decorator emit branches */
  constructor(
    @inject(TYPES.EventRepository)
    private readonly eventRepository: EventRepository,
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
    return new QueueItemProbe(item, queue, this.eventRepository, observation, this.log);
  }

  createMarkQueueItemCompletedProbe(uuid: string): MarkQueueItemCompletedProbe {
    return new MarkQueueItemCompletedProbe(uuid, this.eventRepository, this.observation.current(), this.log);
  }
}
