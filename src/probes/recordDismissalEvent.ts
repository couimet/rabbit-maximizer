import { EventType } from '../domain.js';
import type { DismissalEventParams } from '../types/index.js';

import { getEventTraceAttributes } from './getEventTraceAttributes.js';

export const recordDismissalEvent = (params: DismissalEventParams) =>
  params.events.record(
    {
      type: EventType.dismissed,
      repo_full_name: params.repo_full_name,
      pr_number: params.pr_number,
      ...getEventTraceAttributes(),
      payload: { reason: params.reason },
    },
    params.tx,
  );
