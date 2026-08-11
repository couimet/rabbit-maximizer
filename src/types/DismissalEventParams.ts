import type { EventRepository } from '../db/index.js';
import type { DismissalReason } from '../DismissalReason.js';
import type { ObservationContext } from '../observability/index.js';

import type { Prisma } from '@prisma/client';

export interface DismissalEventParams {
  readonly events: EventRepository;
  readonly tx: Prisma.TransactionClient;
  readonly reason: DismissalReason;
  readonly observation: ObservationContext;
  readonly repo_full_name: string;
  readonly pr_number: number;
}
