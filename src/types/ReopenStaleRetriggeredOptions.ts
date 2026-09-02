export interface ReopenStaleRetriggeredOptions {
  readonly prTitle: string;
  readonly coderabbitRunId: string | undefined;
  readonly cooldownUntil: Date | undefined;
}
