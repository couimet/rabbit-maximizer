/**
 * Error codes for {@link @couimet/prisma-repo}.
 *
 * Values carry a _P<NNNN> suffix that maps directly to Prisma's error codes.
 * This keeps the enum human-readable while preserving the Prisma code for
 * debugging and documentation lookups.
 *
 * Please keep alphabetical order for ease of maintenance.
 */
export enum PrismaErrorCodes {
  PRISMA_FIELD_TYPE_MISMATCH_P2005 = 'PRISMA_FIELD_TYPE_MISMATCH_P2005',
  PRISMA_RECORD_NOT_FOUND_P2025 = 'PRISMA_RECORD_NOT_FOUND_P2025',
  PRISMA_UNIQUE_CONSTRAINT_VIOLATION_P2002 = 'PRISMA_UNIQUE_CONSTRAINT_VIOLATION_P2002',
  SOFT_DELETE_NOT_CONFIGURED = 'SOFT_DELETE_NOT_CONFIGURED',
}
