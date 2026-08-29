import type { Prisma } from '@prisma/client';

export const createMockTx = (): Prisma.TransactionClient => ({}) as Prisma.TransactionClient;
