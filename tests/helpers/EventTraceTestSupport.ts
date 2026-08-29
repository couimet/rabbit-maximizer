import { getUniqueString, getUuid } from '@couimet/dynamic-testing';

export const generateEventTraceContext = (): { correlationId: string; requestId: string; version: string } => ({
  correlationId: getUuid(),
  requestId: getUuid(),
  version: getUniqueString(),
});
