const RUN_ID_PATTERN = /\*\*Run ID\*\*:\s*`([^`]+)`/;

export const extractCoderabbitRunId = (body: string): string | undefined => body.match(RUN_ID_PATTERN)?.[1];
