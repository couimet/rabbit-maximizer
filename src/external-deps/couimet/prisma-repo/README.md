# @couimet/prisma-repo

Repository infrastructure for Prisma. A base class, typed error mapping, transaction enforcement, and error classes — the layer Prisma leaves you to build yourself.

## Install

```bash
pnpm add @couimet/prisma-repo
```

## Usage

```typescript
import { BasePrismaRepository, PrismaRecordNotFoundError } from '@couimet/prisma-repo';

class MyRepository extends BasePrismaRepository {
  // enforceTx guarantees every operation in the callback shares the same
  // Prisma.TransactionClient — even when the caller doesn't provide one.
  async markReviewedByUuid(uuid: string, tx?: Prisma.TransactionClient): Promise<QueueItem | undefined> {
    return this.enforceTx(tx, async (db) => {
      try {
        const updated = await this.withPrismaErrorHandling(
          'reviewQueue',
          () => db.reviewQueue.update({ where: { uuid }, data: { status: 'reviewed', reviewed_at: new Date() } }),
          'MyRepository.markReviewedByUuid',
        );
        return this.toQueueItem(updated);
      } catch (err) {
        if (err instanceof PrismaRecordNotFoundError) {
          return undefined;
        }
        throw err;
      }
    });
  }

  // Single-operation methods use withPrismaErrorHandling directly.
  async markReviewed(id: number, tx: Prisma.TransactionClient): Promise<QueueItem> {
    const row = await this.withPrismaErrorHandling(
      'reviewQueue',
      () => this.client(tx).reviewQueue.update({ where: { id }, data: { status: 'reviewed', reviewed_at: new Date() } }),
      'MyRepository.markReviewed',
    );
    return this.toQueueItem(row);
  }
}
```

## API

### `BasePrismaRepository`

| Member                                                        | Visibility  | Description                                                    |
| ------------------------------------------------------------- | ----------- | -------------------------------------------------------------- |
| `log`                                                         | `protected` | Logger instance                                                |
| `client(tx?)`                                                 | `protected` | Returns `tx` when provided, otherwise the root client          |
| `enforceTx(tx, fn)`                                           | `protected` | Ensures `fn` always receives a `TransactionClient`             |
| `withPrismaErrorHandling(modelName, operation, functionName)` | `protected` | Executes `operation`, catches P2025/P2005, throws typed errors |

`enforceTx` passes `tx` through directly when provided, or wraps `fn` in `prisma.$transaction` when `tx` is `undefined`. Composes with `withPrismaErrorHandling` — the callback closes over `db` and passes it into the operation lambda.

### Error classes

| Class                          | Prisma code | Error code                         |
| ------------------------------ | ----------- | ---------------------------------- |
| `PrismaRecordNotFoundError`    | P2025       | `PRISMA_RECORD_NOT_FOUND_P2025`    |
| `PrismaFieldTypeMismatchError` | P2005       | `PRISMA_FIELD_TYPE_MISMATCH_P2005` |

Both extend `DetailedError`. Callers can `instanceof` check or match on `.code`.

### `PrismaErrorCodes`

Enum of error code constants:

| Member                             | Value                                |
| ---------------------------------- | ------------------------------------ |
| `PRISMA_RECORD_NOT_FOUND_P2025`    | `'PRISMA_RECORD_NOT_FOUND_P2025'`    |
| `PRISMA_FIELD_TYPE_MISMATCH_P2005` | `'PRISMA_FIELD_TYPE_MISMATCH_P2005'` |

### `PrismaErrorOptions`

Constructor options type for the error classes. Picks `functionName`, `details`, and `cause` from `DetailedError`'s `ErrorOptions` so their types stay in sync. Adds `tableName` (the Prisma model name where the error occurred).

## License

MIT
