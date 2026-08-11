import { randomUUID } from 'node:crypto';

export const generateRunId = (): string => randomUUID();
