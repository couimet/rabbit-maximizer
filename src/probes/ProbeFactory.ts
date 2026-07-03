import type { EventRepository } from '../db/eventRepository.js';
import type { QueueRepository } from '../db/queueRepository.js';
import { TYPES } from '../inversify-types.js';
import type { ObservationContext } from '../observability/observationContext.js';
import type { QueueItem } from '../types/index.js';

import { DetectedProbe, type DetectedProbeContext } from './DetectedProbe.js';
import { QueueItemProbe } from './QueueItemProbe.js';

import type { Logger } from '@couimet/logger-contract';
import { inject, injectable } from 'inversify';

@injectable()
export class ProbeFactory {
  /* c8 ignore start — decorator emit branches */
  constructor(
    @inject(TYPES.EventRepository)
    private readonly eventRepository: EventRepository,
    @inject(TYPES.QueueRepository)
    private readonly queueRepository: QueueRepository,
    @inject(TYPES.Logger) private readonly log: Logger,
  ) {}
  /* c8 ignore stop */

  createDetectedProbe(context: DetectedProbeContext, observation: ObservationContext): DetectedProbe {
    return new DetectedProbe(context, this.eventRepository, observation, this.log);
  }

  createQueueItemProbe(item: QueueItem, observation: ObservationContext): QueueItemProbe {
    return new QueueItemProbe(item, this.queueRepository, this.eventRepository, observation, this.log);
  }
}
