# prisma-extension-soft-delete

Prisma client extension for soft-delete support. Provides a configurable way to mark rows as deleted without removing them from the database.

A similar package exists on npm: [`prisma-extension-soft-delete`](https://www.npmjs.com/package/prisma-extension-soft-delete) by olivierwilkinson. That package offers nested operation support and delete→update conversion via `withNestedOperations`. This module takes a simpler approach (zero dependencies, top-level `$allOperations` hook) and additionally filters single `update` calls, which the npm package passes through unfiltered.

## How it works

Uses a **reverse boolean** naming pattern: `is_not_deleted` (nullable `Boolean`, defaults to `true`).

- **Active rows** have `is_not_deleted = true`. Combined with the `@@unique([comment_id, is_not_deleted])` constraint, at most one active row per natural key is allowed.
- **Soft-deleted rows** have `is_not_deleted = null`. In SQL, `NULL != NULL` within unique constraints, so an unlimited number of soft-deleted rows can exist for the same natural key.
- The `deleted_at` column (`DateTime?`) is purely informational — it records when the deletion occurred but plays no role in uniqueness or query filtering.

## Usage

```ts
const prisma = new PrismaClient().$extends(softDeleteExtension({ models: { CoderabbitComment: true } }));
```

After extension, read queries (`findFirst`, `findMany`, `count`, etc.) and write queries (`update`, `updateMany`) on configured models automatically inject `is_not_deleted: true` into their `WHERE` clause. Read queries only return active rows; write queries only modify active rows — attempting to update a soft-deleted row produces a "Record not found" error.

Uses Prisma's `$allOperations` hook, which receives the model name as a runtime string. Only configured models are affected; all other models pass through unchanged.

## SoftDeleteConfig

Repository classes that work with soft-deletable models instantiate `SoftDeleteConfig` to retrieve the correct column values without hardcoding column names:

- **`activeFilter`** — `{ is_not_deleted: true }`, used in `WHERE` clauses to scope queries to active rows.
- **`activeMarker`** — same as `activeFilter`, used in `CREATE` data to mark new rows as active.
- **`softDeleteMarker()`** — returns `{ is_not_deleted: null, deleted_at: <now> }`, used in `UPDATE` mutations to soft-delete a row.

Custom column names are supported by passing an options object to the constructor.
