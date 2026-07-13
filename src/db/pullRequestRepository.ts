import { TYPES } from '../inversify-types.js';

import { BasePrismaRepository } from './BasePrismaRepository.js';

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
  recordRetrigger(id: number, tx: Prisma.TransactionClient): Promise<void>;
  recordReview(id: number, tx: Prisma.TransactionClient): Promise<void>;
}

@injectable()
export class PullRequestRepositoryImpl extends BasePrismaRepository implements PullRequestRepository {
  /* c8 ignore start — decorator emit branches */
  constructor(@inject(TYPES.PrismaClient) prisma: PrismaClient, @inject(TYPES.Logger) log: Logger) {
    super(prisma, log);
  }
  /* c8 ignore stop */

  async upsert(
    repoFullName: string,
    prNumber: number,
    data: { prTitle?: string; reviewLimitAt?: Date },
    tx?: Prisma.TransactionClient,
  ): Promise<{ id: number; created: boolean }> {
    const db = this.client(tx);

    const existing = await db.pullRequest.findUnique({
      where: { repo_full_name_pr_number: { repo_full_name: repoFullName, pr_number: prNumber } },
      select: { id: true },
    });

    if (existing) {
      const updateData: Record<string, unknown> = {};
      if (data.reviewLimitAt) {
        updateData.last_review_limit_at = data.reviewLimitAt;
      }
      if (data.prTitle !== undefined) {
        updateData.title = data.prTitle;
      }
      if (Object.keys(updateData).length > 0) {
        await db.pullRequest.update({ where: { id: existing.id }, data: updateData });
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
  }

  async findByRepoAndPr(repoFullName: string, prNumber: number, tx?: Prisma.TransactionClient): Promise<{ id: number } | null> {
    const row = await this.client(tx).pullRequest.findUnique({
      where: { repo_full_name_pr_number: { repo_full_name: repoFullName, pr_number: prNumber } },
      select: { id: true },
    });
    return row;
  }

  async updateTitle(id: number, title: string, tx: Prisma.TransactionClient): Promise<void> {
    await this.client(tx).pullRequest.update({ where: { id }, data: { title } });
    this.log.debug({ fn: 'PullRequestRepositoryImpl.updateTitle', id }, 'Updated PullRequest title');
  }

  async recordRetrigger(id: number, tx: Prisma.TransactionClient): Promise<void> {
    await this.client(tx).pullRequest.update({
      where: { id },
      data: {
        retrigger_count: { increment: 1 },
        last_review_requested_at: new Date(),
      },
    });
    this.log.debug({ fn: 'PullRequestRepositoryImpl.recordRetrigger', id }, 'Recorded retrigger on PullRequest');
  }

  async recordReview(id: number, tx: Prisma.TransactionClient): Promise<void> {
    await this.client(tx).pullRequest.update({
      where: { id },
      data: {
        review_count: { increment: 1 },
        last_coderabbit_review_at: new Date(),
      },
    });
    this.log.debug({ fn: 'PullRequestRepositoryImpl.recordReview', id }, 'Recorded review on PullRequest');
  }
}
