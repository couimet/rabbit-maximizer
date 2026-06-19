import type { Logger } from "@couimet/logger-contract";
import type { Prisma } from "@prisma/client";
import type { ObservationContext } from "../observability/observationContext.js";
import type { EventLogEntry } from "../types/index.js";

/**
 * Base for domain probes that record a business-significant event. Probes carry
 * the observation context, log via domain-semantic methods, and delegate the row
 * write to EventRepository — keeping callers free of persistence plumbing.
 */
export abstract class EventProbe {
  protected constructor(
    protected readonly observation: ObservationContext,
    protected readonly log: Logger,
  ) {}

  abstract processStarted(): Promise<void>;
  abstract processCompleted(
    tx?: Prisma.TransactionClient,
  ): Promise<EventLogEntry>;
}
