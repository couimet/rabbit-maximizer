import type { EventRepository } from '../db/eventRepository.js';
import { TYPES } from '../inversify-types.js';
import type { ObservationContext } from '../observability/observationContext.js';

import { DetectedProbe, type DetectedProbeContext } from './DetectedProbe.js';

import type { Logger } from '@couimet/logger-contract';
import { inject, injectable } from 'inversify';

@injectable()
export class ProbeFactory {
  /* c8 ignore start — decorator emit branches */
  constructor(
    @inject(TYPES.EventRepository)
    private readonly eventRepository: EventRepository,
    @inject(TYPES.Logger) private readonly log: Logger,
  ) {}
  /* c8 ignore stop */

  createDetectedProbe(context: DetectedProbeContext, observation: ObservationContext): DetectedProbe {
    return new DetectedProbe(context, this.eventRepository, observation, this.log);
  }
}
