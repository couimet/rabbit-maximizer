import { BasePrismaRepository } from '../external-deps/couimet/prisma-repo/BasePrismaRepository.js';
import { TYPES } from '../inversify-types.js';
import { CodeRabbitCommentType } from '../types/CodeRabbitCommentType.js';
import type { PendingAcknowledgement } from '../types/PendingAcknowledgement.js';
import type { UpsertPullRequestResult } from '../types/UpsertPullRequestResult.js';

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
  upsert(
    repoFullName: string,
    prNumber: number,
    data: { prTitle?: string; reviewLimitAt?: Date },
    tx: Prisma.TransactionClient,
  ): Promise<UpsertPullRequestResult>;
  findByRepoAndPr(repoFullName: string, prNumber: number, tx?: Prisma.TransactionClient): Promise<{ id: number } | null>;
  updateTitle(id: number, title: string, tx: Prisma.TransactionClient): Promise<void>;
  incrementRetriggerCount(id: number, tx: Prisma.TransactionClient): Promise<void>;
  recordReview(id: number, tx: Prisma.TransactionClient): Promise<void>;
  updateLastCoderabbitReviewResult(id: number, reviewUrl: string, reviewState: CodeRabbitCommentType, tx: Prisma.TransactionClient): Promise<void>;
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
    tx: Prisma.TransactionClient,
  ): Promise<UpsertPullRequestResult> {
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

  async updateLastCoderabbitReviewResult(id: number, reviewUrl: string, reviewState: CodeRabbitCommentType, tx: Prisma.TransactionClient): Promise<void> {
    await this.withPrismaErrorHandling(
      () =>
        this.client(tx).pullRequest.update({
          where: { id },
          data: { last_review_url: reviewUrl, last_review_state: reviewState, last_coderabbit_review_at: new Date() },
        }),
      'PullRequestRepositoryImpl.updateLastCoderabbitReviewResult',
    );
    this.log.debug(
      { fn: 'PullRequestRepositoryImpl.updateLastCoderabbitReviewResult', id, reviewUrl, reviewState },
      'Updated PullRequest last CodeRabbit review',
    );
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
}
