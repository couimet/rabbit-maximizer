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
  private readonly isDeletedColumn: string;
  private readonly deletedAtColumn: string;

  constructor(isDeletedColumn = 'is_deleted', deletedAtColumn = 'deleted_at') {
    this.isDeletedColumn = isDeletedColumn;
    this.deletedAtColumn = deletedAtColumn;
    this.activeFilter = Object.freeze({ [isDeletedColumn]: false });
    this.activeMarker = this.activeFilter;
  }

  /** Mutation data fragment: `{ is_deleted: true, deleted_at: <now> }`. */
  softDeleteMarker(): Record<string, boolean | Date> {
    return { [this.isDeletedColumn]: true, [this.deletedAtColumn]: new Date() };
  }
}
