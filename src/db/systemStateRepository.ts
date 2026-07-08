import { TYPES } from '../inversify-types.js';
import { SchedulerStatus } from '../types/SchedulerStatus.js';

import { BasePrismaRepository } from './BasePrismaRepository.js';

import type { Logger } from '@couimet/logger-contract';
import { Prisma, type PrismaClient } from '@prisma/client';
import { inject, injectable } from 'inversify';

export enum StateKey {
  lastPollStartedAt = 'last_poll_started_at',
  lastPollCompletedAt = 'last_poll_completed_at',
  lastPollOutcome = 'last_poll_outcome',
  schedulerStatus = 'scheduler_status',
  nextReviewAvailableAt = 'next_review_available_at',
}

type ValueColumn = 'value_text' | 'value_integer' | 'value_float' | 'value_datetime';

const STATE_KEY_CONFIG: Record<StateKey, { column: ValueColumn }> = {
  [StateKey.lastPollStartedAt]: { column: 'value_datetime' },
  [StateKey.lastPollCompletedAt]: { column: 'value_datetime' },
  [StateKey.lastPollOutcome]: { column: 'value_text' },
  [StateKey.schedulerStatus]: { column: 'value_text' },
  [StateKey.nextReviewAvailableAt]: { column: 'value_datetime' },
};

interface SystemStateRow {
  state_key: string;
  value_text: string | null;
  value_integer: number | null;
  value_float: number | null;
  value_datetime: string | null;
  updated_at: string;
}

type StateKeyToType = {
  [StateKey.lastPollStartedAt]: Date;
  [StateKey.lastPollCompletedAt]: Date;
  [StateKey.lastPollOutcome]: string;
  [StateKey.schedulerStatus]: string;
  [StateKey.nextReviewAvailableAt]: Date;
};

export const VALUE_SETTER: Record<ValueColumn, (base: SystemStateRow, value: unknown) => SystemStateRow> = {
  value_text: (b, v) => ({ ...b, value_text: v as string }),
  value_integer: (b, v) => ({ ...b, value_integer: v as number }),
  value_float: (b, v) => ({ ...b, value_float: v as number }),
  value_datetime: (b, v) => ({ ...b, value_datetime: (v as Date).toISOString() }),
};

export interface SystemStateRepository {
  getState<K extends StateKey>(key: K, tx?: Prisma.TransactionClient): Promise<StateKeyToType[K] | undefined>;
  setState<K extends StateKey>(key: K, value: StateKeyToType[K], tx?: Prisma.TransactionClient): Promise<void>;
  isSchedulerPaused(tx?: Prisma.TransactionClient): Promise<boolean>;
  pauseScheduler(tx?: Prisma.TransactionClient): Promise<void>;
  resumeScheduler(tx?: Prisma.TransactionClient): Promise<void>;
}

@injectable()
export class SystemStateRepositoryImpl extends BasePrismaRepository implements SystemStateRepository {
  constructor(@inject(TYPES.PrismaClient) prisma: PrismaClient, @inject(TYPES.Logger) log: Logger) {
    super(prisma, log);
  }

  async getState<K extends StateKey>(key: K, tx?: Prisma.TransactionClient): Promise<StateKeyToType[K] | undefined> {
    const row = await this.client(tx).systemState.findUnique({
      where: { state_key: key },
    });
    if (!row) return undefined;

    const config = STATE_KEY_CONFIG[key];
    const rawValue = row[config.column];
    if (rawValue === null || rawValue === undefined) return undefined;

    if (config.column === 'value_datetime') {
      return new Date(rawValue as string) as StateKeyToType[K];
    }
    return rawValue as StateKeyToType[K];
  }

  async setState<K extends StateKey>(key: K, value: StateKeyToType[K], tx?: Prisma.TransactionClient): Promise<void> {
    const db = this.client(tx);
    const config = STATE_KEY_CONFIG[key];
    const column = config.column;
    const now = new Date().toISOString();

    const base: SystemStateRow = {
      state_key: key,
      value_text: null,
      value_integer: null,
      value_float: null,
      value_datetime: null,
      updated_at: now,
    };

    const data = VALUE_SETTER[column](base, value);

    await db.systemState.upsert({
      where: { state_key: key },
      create: data as Prisma.SystemStateCreateInput,
      update: data as Prisma.SystemStateUpdateInput,
    });

    this.log.debug({ fn: 'SystemStateRepositoryImpl.setState', key }, 'System state updated');
  }

  async isSchedulerPaused(tx?: Prisma.TransactionClient): Promise<boolean> {
    const status = await this.getState(StateKey.schedulerStatus, tx);
    return status === SchedulerStatus.paused;
  }

  async pauseScheduler(tx?: Prisma.TransactionClient): Promise<void> {
    await this.setState(StateKey.schedulerStatus, SchedulerStatus.paused, tx);
  }

  async resumeScheduler(tx?: Prisma.TransactionClient): Promise<void> {
    await this.setState(StateKey.schedulerStatus, SchedulerStatus.running, tx);
  }
}
