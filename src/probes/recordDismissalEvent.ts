import { EventType } from '../domain.js';
import type { DismissalEventParams } from '../types/index.js';

export const recordDismissalEvent = (params: DismissalEventParams) =>
  params.events.record(
    {
      type: EventType.dismissed,
      repo_full_name: params.repo_full_name,
      pr_number: params.pr_number,
      correlation_id: params.observation.correlationId,
      request_id: params.observation.requestId,
      version: params.observation.version,
      payload: { reason: params.reason },
    },
    params.tx,
  );
