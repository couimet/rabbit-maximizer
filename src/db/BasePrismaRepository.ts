import type { Logger } from '@couimet/logger-contract';
import { Prisma, type PrismaClient } from '@prisma/client';

export abstract class BasePrismaRepository {
  constructor(
    private readonly prisma: PrismaClient,
    protected readonly log: Logger,
  ) {}

  protected client(tx?: Prisma.TransactionClient): Prisma.TransactionClient {
    return tx ?? this.prisma;
  }
}
