import { type ConfigKey } from './configKeys.js';

import { z } from 'zod';

/** A positive integer key. */
export const positiveInt = (key: ConfigKey, fallback: number) => z.coerce.number().int().positive(`${key} must be a positive integer`).default(fallback);
