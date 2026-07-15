import { BasePrismaRepository } from '../external-deps/couimet/prisma-repo/BasePrismaRepository.js';
import { TYPES } from '../inversify-types.js';
import type { PendingAcknowledgement } from '../types/PendingAcknowledgement.js';

import type { Logger } from '@couimet/logger-contract';
import { Prisma, type PrismaClient } from '@prisma/client';
import { inject, injectable } from 'inversify';

export interface PullRequestRepository {
  upsert(
    repoFullName: string,
    prNumber: number,
    data: { prTitle?: string; reviewLimitAt?: Date },
    tx?: Prisma.TransactionClient,
  ): Promise<{ id: number; created: boolean }>;
  findByRepoAndPr(repoFullName: string, prNumber: number, tx?: Prisma.TransactionClient): Promise<{ id: number } | null>;
  updateTitle(id: number, title: string, tx: Prisma.TransactionClient): Promise<void>;
  incrementRetriggerCount(id: number, tx: Prisma.TransactionClient): Promise<void>;
  recordReview(id: number, tx: Prisma.TransactionClient): Promise<void>;
  findPendingAcknowledgement(tx?: Prisma.TransactionClient): Promise<PendingAcknowledgement | undefined>;
  recordAcknowledgement(id: number, tx?: Prisma.TransactionClient): Promise<void>;
}

@injectable()
export class PullRequestRepositoryImpl extends BasePrismaRepository implements PullRequestRepository {
  /* c8 ignore start — decorator emit branches */
  constructor(@inject(TYPES.PrismaClient) prisma: PrismaClient, @inject(TYPES.Logger) log: Logger) {
    super(prisma, Prisma.ModelName.PullRequest, log);
  }
  /* c8 ignore stop */

  // eslint-disable-next-line require-await
  async upsert(
    repoFullName: string,
    prNumber: number,
    data: { prTitle?: string; reviewLimitAt?: Date },
    tx?: Prisma.TransactionClient,
  ): Promise<{ id: number; created: boolean }> {
    return this.enforceTx(tx, async (db) => {
      const existing = await db.pullRequest.findUnique({
        where: { repo_full_name_pr_number: { repo_full_name: repoFullName, pr_number: prNumber } },
        select: { id: true, first_review_limit_at: true },
      });

      if (existing) {
        const updateData: Record<string, unknown> = {};
        if (data.reviewLimitAt) {
          updateData.last_review_limit_at = data.reviewLimitAt;
          if (existing.first_review_limit_at === null) {
            updateData.first_review_limit_at = data.reviewLimitAt;
          }
        }
        if (data.prTitle !== undefined) {
          updateData.title = data.prTitle;
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
          author_login: '<unknown>',
          first_seen_at: new Date(),
          first_review_limit_at: data.reviewLimitAt ?? null,
          last_review_limit_at: data.reviewLimitAt ?? null,
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

  // eslint-disable-next-line require-await
  async findPendingAcknowledgement(tx?: Prisma.TransactionClient): Promise<PendingAcknowledgement | undefined> {
    return this.enforceTx(tx, async (db) => {
      const rows = await db.pullRequest.findMany({
        where: { last_review_requested_at: { not: null } },
        orderBy: { last_review_requested_at: 'asc' },
        select: { id: true, repo_full_name: true, pr_number: true, last_review_requested_at: true, last_coderabbit_acknowledged_at: true },
      });
      for (const row of rows) {
        // Without an acknowledgement, or when the acknowledgement is older than the
        // most recent review request, CodeRabbit has not yet seen the latest retrigger.
        if (!row.last_coderabbit_acknowledged_at || row.last_coderabbit_acknowledged_at < row.last_review_requested_at!) {
          return { id: row.id, repo_full_name: row.repo_full_name, pr_number: row.pr_number, last_review_requested_at: row.last_review_requested_at! };
        }
      }
      return undefined;
    });
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
}
