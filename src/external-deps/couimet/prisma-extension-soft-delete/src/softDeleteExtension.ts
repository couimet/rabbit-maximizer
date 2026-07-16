import { SoftDeleteConfig } from './SoftDeleteConfig.js';

export interface ExtensionModelConfig {
  isDeletedColumn?: string;
  deletedAtColumn?: string;
}

export interface ExtensionConfig {
  readonly models: Record<string, ExtensionModelConfig | true>;
}

type QueryFn = (args: { where?: Record<string, unknown> }, query: (args: { where?: Record<string, unknown> }) => unknown) => unknown;

/**
 * Prisma `$extends()`-compatible extension that auto-injects the soft-delete
 * active filter into read operations for configured models.
 *
 * ```ts
 * const prisma = new PrismaClient().$extends(
 *   softDeleteExtension({ models: { CoderabbitComment: true } })
 * );
 * ```
 *
 * After extension, `findFirst({ where: { comment_id: 42 } })` silently
 * becomes `findFirst({ where: { comment_id: 42, is_deleted: false } })`.
 * Mutations are not intercepted.
 */
export const softDeleteExtension = (config: ExtensionConfig) => ({
  name: 'softDelete' as const,

  query: Object.fromEntries(
    Object.entries(config.models).map(([model, modelConfig]) => {
      const cfg = new SoftDeleteConfig(
        modelConfig === true ? undefined : modelConfig.isDeletedColumn,
        modelConfig === true ? undefined : modelConfig.deletedAtColumn,
      );
      const filter = cfg.activeFilter;
      const merge: QueryFn = (args, query) => {
        args.where = { ...args.where, ...filter };
        return query(args);
      };
      return [
        model,
        {
          findFirst: merge,
          findFirstOrThrow: merge,
          findMany: merge,
          findUnique: merge,
          findUniqueOrThrow: merge,
          count: merge,
          aggregate: merge,
          groupBy: merge,
        },
      ];
    }),
  ) as any,
});
