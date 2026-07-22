import type { EventRepository } from '../db/index.js';
import { BypassReason, EventType } from '../domain.js';
import type { ObservationContext } from '../observability/index.js';

import type { Prisma } from '@prisma/client';

export interface BypassEventParams {
  readonly events: EventRepository;
  readonly tx: Prisma.TransactionClient;
  readonly reason: BypassReason;
  readonly observation: ObservationContext;
  readonly repo_full_name: string;
  readonly pr_number: number;
}

export const recordBypassEvent = (params: BypassEventParams) =>
  params.events.record(
    {
      type: EventType.bypassed,
      repo_full_name: params.repo_full_name,
      pr_number: params.pr_number,
      correlation_id: params.observation.correlationId,
      request_id: params.observation.requestId,
      version: params.observation.version,
      payload: { reason: params.reason },
    },
    params.tx,
  );
