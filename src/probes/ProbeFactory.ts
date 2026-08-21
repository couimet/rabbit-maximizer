import type { EventRepository } from '../db/index.js';
import { TYPES } from '../domain.js';
import type { QueueItem } from '../types/index.js';

import {
  type CreateSchedulerProbeParams,
  DetectedProbe,
  type DetectedProbeContext,
  DirectCommentCheckProbe,
  EnqueueProbe,
  MarkQueueItemReviewedProbe,
  PrScannerProbe,
  PrunerProbe,
  ReviewDetectorProbe,
  ReviewRetriggerProbe,
  SchedulerProbe,
} from './index.js';

import type { Logger } from '@couimet/logger-contract';
import type { Prisma } from '@prisma/client';
import { inject, injectable } from 'inversify';

@injectable()
export class ProbeFactory {
  /* c8 ignore start — decorator emit branches */
  constructor(
    @inject(TYPES.EventRepository) private readonly eventRepository: EventRepository,
    @inject(TYPES.Logger) private readonly log: Logger,
  ) {}
  /* c8 ignore stop */

  createDetectedProbe(context: DetectedProbeContext): DetectedProbe {
    return new DetectedProbe(context, this.eventRepository, this.log);
  }

  createPrScannerProbe(): PrScannerProbe {
    return new PrScannerProbe(this.log);
  }

  createPrunerProbe(): PrunerProbe {
    return new PrunerProbe(this.eventRepository, this.log);
  }

  createMarkQueueItemReviewedProbe(uuid: string): MarkQueueItemReviewedProbe {
    return new MarkQueueItemReviewedProbe(uuid, this.log);
  }

  createEnqueueProbe(tx: Prisma.TransactionClient): EnqueueProbe {
    return new EnqueueProbe(this.eventRepository, tx, this.log);
  }

  createSchedulerProbe(params: CreateSchedulerProbeParams): SchedulerProbe {
    return new SchedulerProbe(params.baseBackoff, params.maxBackoff, params.maxRetriggerAttempts, this.eventRepository, this.log);
  }

  createReviewRetriggerProbe(item: QueueItem): ReviewRetriggerProbe {
    return new ReviewRetriggerProbe(item, this.eventRepository, this.log);
  }

  createReviewDetectorProbe(): ReviewDetectorProbe {
    return new ReviewDetectorProbe(this.eventRepository, this.log);
  }

  createDirectCommentCheckProbe(): DirectCommentCheckProbe {
    return new DirectCommentCheckProbe(this.eventRepository, this.log);
  }
}
