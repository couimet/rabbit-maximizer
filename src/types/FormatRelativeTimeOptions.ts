import type { FormatRelativeTimeGranularity } from './FormatRelativeTimeGranularity.js';

export interface FormatRelativeTimeOptions {
  readonly now?: Date;
  readonly granularity?: FormatRelativeTimeGranularity;
}
