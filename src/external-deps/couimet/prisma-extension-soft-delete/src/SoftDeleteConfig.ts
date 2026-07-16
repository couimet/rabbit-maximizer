/**
 * Column-level configuration for a soft-deletable Prisma model.
 *
 * Instantiated by {@link BasePrismaRepository} when the repository opts in
 * via the `softDelete` option. Exposes `activeFilter` for WHERE clauses,
 * `activeMarker` for CREATE data, and `softDeleteMarker()` for UPDATE mutations.
 */
export class SoftDeleteConfig {
  readonly activeFilter: Readonly<Record<string, boolean>>;
  readonly activeMarker: Readonly<Record<string, boolean>>;
  private readonly isNotDeletedColumn: string;
  private readonly deletedAtColumn: string;

  constructor(opts?: { isNotDeletedColumn?: string; deletedAtColumn?: string }) {
    const { isNotDeletedColumn = 'is_not_deleted', deletedAtColumn = 'deleted_at' } = opts ?? {};
    this.isNotDeletedColumn = isNotDeletedColumn;
    this.deletedAtColumn = deletedAtColumn;
    this.activeFilter = Object.freeze({ [isNotDeletedColumn]: true });
    this.activeMarker = this.activeFilter;
  }

  /** Mutation data fragment: `{ is_not_deleted: null, deleted_at: <now> }`. */
  softDeleteMarker(): Record<string, null | Date> {
    return { [this.isNotDeletedColumn]: null, [this.deletedAtColumn]: new Date() };
  }
}
