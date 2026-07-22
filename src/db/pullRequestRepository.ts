import { PrState, TYPES } from '../domain.js';
import { BasePrismaRepository } from '../external-deps/couimet/prisma-repo/index.js';
import type { PendingAcknowledgement, PullRequestColumnTypes, UpsertPullRequestData } from '../types/index.js';

import type { Logger } from '@couimet/logger-contract';
import { Prisma, type PrismaClient } from '@prisma/client';
import { inject, injectable } from 'inversify';

/** Matches `@@map("pull_request")` in the Prisma schema. */
const PULL_REQUEST_TABLE = 'pull_request';

const FIND_PENDING_ACKNOWLEDGEMENT_SQL = `
  SELECT id, repo_full_name, pr_number, last_review_requested_at
  FROM ${PULL_REQUEST_TABLE}
  WHERE last_review_requested_at IS NOT NULL
    AND (last_coderabbit_acknowledged_at IS NULL OR last_coderabbit_acknowledged_at < last_review_requested_at)
  ORDER BY last_review_requested_at ASC
  LIMIT 1
`;

export interface PullRequestRepository {
  upsert(repoFullName: string, prNumber: number, data: UpsertPullRequestData, tx?: Prisma.TransactionClient): Promise<{ id: number; created: boolean }>;
  findByRepoAndPr(repoFullName: string, prNumber: number, tx?: Prisma.TransactionClient): Promise<{ id: number } | null>;
  findByPrState(prState: PrState, tx?: Prisma.TransactionClient): Promise<Array<{ id: number; repo_full_name: string; pr_number: number }>>;
  findPendingAcknowledgement(tx?: Prisma.TransactionClient): Promise<PendingAcknowledgement | undefined>;
  getColumnMaps<C extends keyof PullRequestColumnTypes>(
    ids: number[],
    columns: readonly C[],
    tx?: Prisma.TransactionClient,
  ): Promise<{ [K in C]: Map<number, PullRequestColumnTypes[K]> }>;
  incrementRetriggerCount(id: number, tx: Prisma.TransactionClient): Promise<void>;
  recordAcknowledgement(id: number, tx?: Prisma.TransactionClient): Promise<void>;
  recordReview(id: number, tx: Prisma.TransactionClient): Promise<void>;
  recordReviewLimitDetection(id: number, reviewLimitAt: Date, tx: Prisma.TransactionClient): Promise<void>;
  updateTitle(id: number, title: string, tx: Prisma.TransactionClient): Promise<void>;
}

@injectable()
export class PullRequestRepositoryImpl extends BasePrismaRepository implements PullRequestRepository {
  /* c8 ignore start — decorator emit branches */
  constructor(@inject(TYPES.PrismaClient) prisma: PrismaClient, @inject(TYPES.Logger) log: Logger) {
    super(prisma, Prisma.ModelName.PullRequest, log);
  }
  /* c8 ignore stop */

  // eslint-disable-next-line require-await
  async upsert(repoFullName: string, prNumber: number, data: UpsertPullRequestData, tx?: Prisma.TransactionClient): Promise<{ id: number; created: boolean }> {
    return this.enforceTx(tx, async (db) => {
      const existing = await db.pullRequest.findUnique({
        where: { repo_full_name_pr_number: { repo_full_name: repoFullName, pr_number: prNumber } },
        select: { id: true },
      });

      if (existing) {
        const updateData: Record<string, unknown> = {};
        if (data.prTitle !== undefined) {
          updateData.title = data.prTitle;
        }
        if (data.prState !== undefined) {
          updateData.pr_state = data.prState;
        }
        if (data.authorLogin !== undefined) {
          updateData.author_login = data.authorLogin;
        }
        if (Object.keys(updateData).length > 0) {
          await this.withPrismaErrorHandling(() => db.pullRequest.update({ where: { id: existing.id }, data: updateData }), 'PullRequestRepositoryImpl.upsert');
        }
        this.log.debug({ fn: 'PullRequestRepositoryImpl.upsert', repoFullName, prNumber, id: existing.id }, 'PullRequest already exists');
        return { id: existing.id, created: false };
      }

      const row = await db.pullRequest.create({
        data: {
          repo_full_name: repoFullName,
          pr_number: prNumber,
          title: data.prTitle ?? '<unknown>',
          author_login: data.authorLogin ?? '<unknown>',
          pr_state: data.prState,
          first_seen_at: new Date(),
        },
      });
      this.log.debug({ fn: 'PullRequestRepositoryImpl.upsert', repoFullName, prNumber, id: row.id }, 'Created PullRequest');
      return { id: row.id, created: true };
    });
  }

  // eslint-disable-next-line require-await
  async findByRepoAndPr(repoFullName: string, prNumber: number, tx?: Prisma.TransactionClient): Promise<{ id: number } | null> {
    return this.enforceTx(tx, (db) =>
      db.pullRequest.findUnique({
        where: { repo_full_name_pr_number: { repo_full_name: repoFullName, pr_number: prNumber } },
        select: { id: true },
      }),
    );
  }

  async updateTitle(id: number, title: string, tx: Prisma.TransactionClient): Promise<void> {
    await this.withPrismaErrorHandling(() => this.client(tx).pullRequest.update({ where: { id }, data: { title } }), 'PullRequestRepositoryImpl.updateTitle');
    this.log.debug({ fn: 'PullRequestRepositoryImpl.updateTitle', id }, 'Updated PullRequest title');
  }

  async incrementRetriggerCount(id: number, tx: Prisma.TransactionClient): Promise<void> {
    await this.withPrismaErrorHandling(
      () =>
        this.client(tx).pullRequest.update({
          where: { id },
          data: {
            retrigger_count: { increment: 1 },
            last_review_requested_at: new Date(),
          },
        }),
      'PullRequestRepositoryImpl.incrementRetriggerCount',
    );
    this.log.debug({ fn: 'PullRequestRepositoryImpl.incrementRetriggerCount', id }, 'Incremented retrigger count on PullRequest');
  }

  async recordReview(id: number, tx: Prisma.TransactionClient): Promise<void> {
    await this.withPrismaErrorHandling(
      () =>
        this.client(tx).pullRequest.update({
          where: { id },
          data: {
            review_count: { increment: 1 },
            last_coderabbit_review_at: new Date(),
          },
        }),
      'PullRequestRepositoryImpl.recordReview',
    );
    this.log.debug({ fn: 'PullRequestRepositoryImpl.recordReview', id }, 'Recorded review on PullRequest');
  }

  async findPendingAcknowledgement(tx?: Prisma.TransactionClient): Promise<PendingAcknowledgement | undefined> {
    const db = this.client(tx);
    const rows =
      await db.$queryRawUnsafe<Array<{ id: number; repo_full_name: string; pr_number: number; last_review_requested_at: Date }>>(
        FIND_PENDING_ACKNOWLEDGEMENT_SQL,
      );
    if (rows.length === 0) {
      return undefined;
    }
    return {
      id: rows[0].id,
      repo_full_name: rows[0].repo_full_name,
      pr_number: rows[0].pr_number,
      last_review_requested_at: new Date(rows[0].last_review_requested_at),
    };
  }

  async recordAcknowledgement(id: number, tx?: Prisma.TransactionClient): Promise<void> {
    await this.enforceTx(tx, async (db) => {
      await this.withPrismaErrorHandling(
        () => db.pullRequest.update({ where: { id }, data: { last_coderabbit_acknowledged_at: new Date() } }),
        'PullRequestRepositoryImpl.recordAcknowledgement',
      );
      this.log.debug({ fn: 'PullRequestRepositoryImpl.recordAcknowledgement', id }, 'Recorded CodeRabbit acknowledgement on PullRequest');
    });
  }

  // eslint-disable-next-line require-await
  async findByPrState(prState: PrState, tx?: Prisma.TransactionClient): Promise<Array<{ id: number; repo_full_name: string; pr_number: number }>> {
    return this.enforceTx(tx, (db) =>
      db.pullRequest.findMany({
        where: { pr_state: prState },
        select: { id: true, repo_full_name: true, pr_number: true },
      }),
    );
  }

  async getColumnMaps<C extends keyof PullRequestColumnTypes>(
    ids: number[],
    columns: readonly C[],
    tx?: Prisma.TransactionClient,
  ): Promise<{ [K in C]: Map<number, PullRequestColumnTypes[K]> }> {
    if (ids.length === 0 || columns.length === 0) {
      return {} as { [K in C]: Map<number, PullRequestColumnTypes[K]> };
    }

    const select = { id: true } as Record<string, boolean>;
    for (const col of columns) {
      select[col as string] = true;
    }

    const rows = await this.enforceTx(tx, (db) => db.pullRequest.findMany({ where: { id: { in: ids } }, select }));

    const result = {} as { [K in C]: Map<number, PullRequestColumnTypes[K]> };
    for (const col of columns) {
      (result as Record<string, unknown>)[col as string] = new Map();
    }
    for (const row of rows) {
      for (const col of columns) {
        (result as Record<string, Map<number, unknown>>)[col as string].set(
          (row as Record<string, unknown>).id as number,
          (row as Record<string, unknown>)[col as string],
        );
      }
    }
    return result;
  }

  async recordReviewLimitDetection(id: number, reviewLimitAt: Date, tx: Prisma.TransactionClient): Promise<void> {
    await this.enforceTx(tx, async (db) => {
      const existing = await db.pullRequest.findUnique({
        where: { id },
        select: { first_review_limit_at: true },
      });
      const updateData: Record<string, unknown> = { last_review_limit_at: reviewLimitAt };
      if (existing && existing.first_review_limit_at === null) {
        updateData.first_review_limit_at = reviewLimitAt;
      }
      await this.withPrismaErrorHandling(
        () => db.pullRequest.update({ where: { id }, data: updateData }),
        'PullRequestRepositoryImpl.recordReviewLimitDetection',
      );
    });
    this.log.debug({ fn: 'PullRequestRepositoryImpl.recordReviewLimitDetection', id }, 'Recorded review limit detection on PullRequest');
  }
}
