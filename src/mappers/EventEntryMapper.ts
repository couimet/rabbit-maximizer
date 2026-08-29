import type { EventEntryResponse, EventLogEntry } from '../types/index.js';

import { injectable } from 'inversify';

@injectable()
export class EventEntryMapper {
  mapToEventEntryResponse(input: EventLogEntry): EventEntryResponse {
    return {
      id: input.id,
      uuid: input.uuid,
      ts: input.ts.toISOString(),
      type: input.type as EventEntryResponse['type'],
      repo_full_name: input.repo_full_name,
      pr_number: input.pr_number,
      correlation_id: input.correlation_id,
      request_id: input.request_id,
      version: input.version,
      metadata: input.metadata as EventEntryResponse['metadata'],
      payload: input.payload as EventEntryResponse['payload'],
    };
  }

  mapToEventEntryResponseList(inputs: EventLogEntry[]): EventEntryResponse[] {
    return inputs.map((item) => this.mapToEventEntryResponse(item));
  }
}
