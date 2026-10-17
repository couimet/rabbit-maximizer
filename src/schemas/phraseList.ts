import { type ConfigKey } from './configKeys.js';

import { z } from 'zod';

/** A non-empty list of phrases. A consumer matches each phrase as a case-sensitive substring. */
export const phraseList = (key: ConfigKey, fallback: string[]) =>
  z
    .array(z.string().min(1, `${key} entries must be non-empty`), { error: `${key} must be a list of strings` })
    .min(1, `${key} must have at least one entry`)
    .default(fallback);
