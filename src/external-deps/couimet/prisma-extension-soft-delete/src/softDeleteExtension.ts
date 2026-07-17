import { SoftDeleteConfig } from './SoftDeleteConfig.js';

export interface ExtensionModelConfig {
  isNotDeletedColumn?: string;
  deletedAtColumn?: string;
}

export interface ExtensionConfig {
  readonly models: Record<string, ExtensionModelConfig | true>;
}

const FILTERED_OPERATIONS = new Set([
  'findFirst',
  'findFirstOrThrow',
  'findMany',
  'findUnique',
  'findUniqueOrThrow',
  'count',
  'aggregate',
  'groupBy',
  'update',
  'updateMany',
]);

/**
 * Prisma `$extends()`-compatible extension that auto-injects the soft-delete
 * active filter into read AND write operations for configured models.
 *
 * ```ts
 * const prisma = new PrismaClient().$extends(
 *   softDeleteExtension({ models: { CoderabbitComment: true } })
 * );
 * ```
 *
 * After extension, read queries become `WHERE ... AND is_not_deleted = true`
 * and update/updateMany queries automatically filter to active rows only,
 * preventing accidental modification of soft-deleted records.
 *
 * Uses Prisma's `$allOperations` hook — the handler receives the model name as
 * a runtime string and looks up the model's config. This eliminates the
 * `Object.fromEntries` + `as any` pattern required by per-model handlers.
 *
 * Similar to the `prisma-extension-soft-delete` npm package by
 * olivierwilkinson, but uses the simpler `$allOperations` top-level hook
 * (no `withNestedOperations` dependency) and filters single `update` calls,
 * which the npm package passes through unfiltered.
 */
export const softDeleteExtension = (config: ExtensionConfig) => {
  const modelConfigs = new Map<string, SoftDeleteConfig>(
    Object.entries(config.models).map(([model, modelConfig]) => {
      const cfg =
        modelConfig === true
          ? new SoftDeleteConfig()
          : new SoftDeleteConfig({
              isNotDeletedColumn: modelConfig.isNotDeletedColumn,
              deletedAtColumn: modelConfig.deletedAtColumn,
            });
      return [model, cfg];
    }),
  );

  return {
    name: 'softDelete' as const,
    query: {
      $allOperations: ({
        args,
        query,
        model,
        operation,
      }: {
        model?: string;
        operation: string;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        args: any;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        query: (args: any) => any;
      }) => {
        const cfg = modelConfigs.get(model ?? '');
        if (!cfg) return query(args);
        if (FILTERED_OPERATIONS.has(operation)) {
          args.where = { ...args.where, ...cfg.activeFilter };
        }
        return query(args);
      },
    },
  };
};
