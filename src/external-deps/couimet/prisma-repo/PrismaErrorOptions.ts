/* c8 ignore next 14 — type-only file, no runtime code to cover */
import type { ErrorOptions } from '@couimet/detailed-error';

/**
 * Constructor options for Prisma error classes.
 *
 * {@link functionName}, {@link details}, and {@link cause} are picked from
 * {@link ErrorOptions} so their types stay in sync without copy-paste.
 * Only {@link tableName} is added — each error class provides its own fixed
 * {@link ErrorOptions.code} and {@link ErrorOptions.message}.
 */
export type PrismaErrorOptions = Pick<ErrorOptions<string>, 'functionName' | 'details' | 'cause'> & {
  /** The Prisma model name (camelCase) where the error occurred */
  readonly tableName: string;
};
