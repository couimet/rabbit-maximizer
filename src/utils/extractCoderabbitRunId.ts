import { CODERABBIT_RUN_ID_MAX_LENGTH } from '../schemas/index.js';

const RUN_ID_PATTERN = /\*\*Run ID\*\*:\s*`([^`]+)`/;

export const extractCoderabbitRunId = (body: string): string | undefined => {
  const id = body.match(RUN_ID_PATTERN)?.[1];
  return id?.slice(0, CODERABBIT_RUN_ID_MAX_LENGTH);
};
