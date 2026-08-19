import { SchedulerStatus, TYPES } from '../domain.js';
import { BasePrismaRepository } from '../external-deps/couimet/prisma-repo/index.js';
import type { DashboardSystemState } from '../types/index.js';

import type { Logger } from '@couimet/logger-contract';
import { Prisma, type PrismaClient } from '@prisma/client';
import { inject, injectable } from 'inversify';

export enum StateKey {
  lastPollStartedAt = 'last_poll_started_at',
  lastPollCompletedAt = 'last_poll_completed_at',
  lastPollOutcome = 'last_poll_outcome',
  lastScanStartedAt = 'last_scan_started_at',
  lastScanCompletedAt = 'last_scan_completed_at',
  lastSchedulerTickAt = 'last_scheduler_tick_at',
  schedulerStatus = 'scheduler_status',
  nextReviewAvailableAt = 'next_review_available_at',
}

type ValueColumn = 'value_text' | 'value_integer' | 'value_float' | 'value_datetime';

const STATE_KEY_CONFIG: Record<StateKey, { column: ValueColumn }> = {
  [StateKey.lastPollStartedAt]: { column: 'value_datetime' },
  [StateKey.lastPollCompletedAt]: { column: 'value_datetime' },
  [StateKey.lastPollOutcome]: { column: 'value_text' },
  [StateKey.lastScanStartedAt]: { column: 'value_datetime' },
  [StateKey.lastScanCompletedAt]: { column: 'value_datetime' },
  [StateKey.lastSchedulerTickAt]: { column: 'value_datetime' },
  [StateKey.schedulerStatus]: { column: 'value_text' },
  [StateKey.nextReviewAvailableAt]: { column: 'value_datetime' },
};

const DASHBOARD_STATE_KEYS: readonly StateKey[] = [StateKey.schedulerStatus, StateKey.lastSchedulerTickAt, StateKey.nextReviewAvailableAt];

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
  [StateKey.lastScanStartedAt]: Date;
  [StateKey.lastScanCompletedAt]: Date;
  [StateKey.lastSchedulerTickAt]: Date;
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
  getDashboardSystemState(): Promise<DashboardSystemState>;
  isSchedulerPaused(tx: Prisma.TransactionClient | undefined): Promise<boolean>;
  pauseScheduler(tx: Prisma.TransactionClient | undefined): Promise<void>;
  resumeScheduler(tx: Prisma.TransactionClient | undefined): Promise<void>;
  getNextReviewAvailableAt(tx: Prisma.TransactionClient | undefined): Promise<Date | undefined>;
  setNextReviewAvailableAt(earliest: Date, tx: Prisma.TransactionClient | undefined): Promise<void>;
  setNextReviewAvailableAtIfLater(earliest: Date, tx: Prisma.TransactionClient | undefined): Promise<void>;
  getLastSchedulerTickAt(tx: Prisma.TransactionClient | undefined): Promise<Date | undefined>;
  setLastSchedulerTickAt(ts: Date, tx: Prisma.TransactionClient | undefined): Promise<void>;
  getLastScanCompletedAt(tx: Prisma.TransactionClient | undefined): Promise<Date | undefined>;
  setLastScanCompletedAt(ts: Date, tx: Prisma.TransactionClient | undefined): Promise<void>;
  setLastScanStartedAt(ts: Date, tx: Prisma.TransactionClient | undefined): Promise<void>;
}

@injectable()
export class SystemStateRepositoryImpl extends BasePrismaRepository implements SystemStateRepository {
  constructor(@inject(TYPES.PrismaClient) prisma: PrismaClient, @inject(TYPES.Logger) log: Logger) {
    super(prisma, Prisma.ModelName.SystemState, log);
  }

  private parseStateRow<K extends StateKey>(key: K, row: SystemStateRow): StateKeyToType[K] | undefined {
    const config = STATE_KEY_CONFIG[key];
    const rawValue = row[config.column];
    if (rawValue === null || rawValue === undefined) return undefined;
    if (config.column === 'value_datetime') return new Date(rawValue as string) as StateKeyToType[K];
    return rawValue as StateKeyToType[K];
  }

  private buildReadValue(map: Map<string, SystemStateRow>) {
    return <K extends StateKey>(key: K): StateKeyToType[K] | undefined => {
      const row = map.get(key);
      return row ? this.parseStateRow(key, row) : undefined;
    };
  }

  // eslint-disable-next-line require-await
  async getState<K extends StateKey>(key: K, tx: Prisma.TransactionClient | undefined): Promise<StateKeyToType[K] | undefined> {
    return this.enforceTx(tx, async (db) => {
      const row = await db.systemState.findUnique({
        where: { state_key: key },
      });
      if (!row) return undefined;
      return this.parseStateRow(key, row);
    });
  }

  // eslint-disable-next-line require-await
  async setState<K extends StateKey>(key: K, value: StateKeyToType[K], tx: Prisma.TransactionClient | undefined): Promise<void> {
    return this.enforceTx(tx, async (db) => {
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

      await this.withPrismaErrorHandling(
        () =>
          db.systemState.upsert({
            where: { state_key: key },
            create: data as Prisma.SystemStateCreateInput,
            update: data as Prisma.SystemStateUpdateInput,
          }),
        'SystemStateRepositoryImpl.setState',
      );

      this.log.debug({ fn: 'SystemStateRepositoryImpl.setState', key }, 'System state updated');
    });
  }

  // eslint-disable-next-line require-await
  async getDashboardSystemState(): Promise<DashboardSystemState> {
    return this.enforceTx(undefined, async (db) => {
      const rows = await db.systemState.findMany({
        where: { state_key: { in: [...DASHBOARD_STATE_KEYS] } },
      });

      const map = new Map(rows.map((r) => [r.state_key, r]));
      const readValue = this.buildReadValue(map);

      return {
        paused: SchedulerStatus.paused === readValue(StateKey.schedulerStatus),
        lastSchedulerTickAt: readValue(StateKey.lastSchedulerTickAt),
        nextReviewAvailableAt: readValue(StateKey.nextReviewAvailableAt),
      };
    });
  }

  async isSchedulerPaused(tx: Prisma.TransactionClient | undefined): Promise<boolean> {
    const status = await this.getState(StateKey.schedulerStatus, tx);
    return status === SchedulerStatus.paused;
  }

  async pauseScheduler(tx: Prisma.TransactionClient | undefined): Promise<void> {
    await this.setState(StateKey.schedulerStatus, SchedulerStatus.paused, tx);
  }

  async resumeScheduler(tx: Prisma.TransactionClient | undefined): Promise<void> {
    await this.setState(StateKey.schedulerStatus, SchedulerStatus.running, tx);
  }

  // eslint-disable-next-line require-await
  async getLastSchedulerTickAt(tx: Prisma.TransactionClient | undefined): Promise<Date | undefined> {
    return this.getState(StateKey.lastSchedulerTickAt, tx);
  }

  async setLastSchedulerTickAt(ts: Date, tx: Prisma.TransactionClient | undefined): Promise<void> {
    await this.setState(StateKey.lastSchedulerTickAt, ts, tx);
    this.log.info({ fn: 'setLastSchedulerTickAt', ts }, 'Last scheduler tick updated');
  }

  // eslint-disable-next-line require-await
  async getNextReviewAvailableAt(tx: Prisma.TransactionClient | undefined): Promise<Date | undefined> {
    return this.getState(StateKey.nextReviewAvailableAt, tx);
  }

  async setNextReviewAvailableAt(earliest: Date, tx: Prisma.TransactionClient | undefined): Promise<void> {
    await this.setState(StateKey.nextReviewAvailableAt, earliest, tx);
    this.log.info({ fn: 'setNextReviewAvailableAt', earliest }, 'Global review cooldown updated');
  }

  async setNextReviewAvailableAtIfLater(earliest: Date, tx: Prisma.TransactionClient | undefined): Promise<void> {
    await this.enforceTx(tx, async (db) => {
      const isoEarliest = earliest.toISOString();
      const now = new Date().toISOString();

      await this.withPrismaErrorHandling(
        () =>
          db.$executeRaw`
            INSERT INTO system_state (state_key, value_text, value_integer, value_float, value_datetime, updated_at)
            VALUES (${StateKey.nextReviewAvailableAt}, NULL, NULL, NULL, ${isoEarliest}, ${now})
            ON CONFLICT(state_key) DO UPDATE SET
              value_datetime = CASE WHEN system_state.value_datetime IS NULL OR system_state.value_datetime < excluded.value_datetime THEN excluded.value_datetime ELSE system_state.value_datetime END,
              updated_at = excluded.updated_at
          `,
        'SystemStateRepositoryImpl.setNextReviewAvailableAtIfLater',
      );
    });

    this.log.info({ fn: 'setNextReviewAvailableAtIfLater', earliest }, 'Global review cooldown updated');
  }

  // eslint-disable-next-line require-await
  async getLastScanCompletedAt(tx: Prisma.TransactionClient | undefined): Promise<Date | undefined> {
    return this.getState(StateKey.lastScanCompletedAt, tx);
  }

  async setLastScanCompletedAt(ts: Date, tx: Prisma.TransactionClient | undefined): Promise<void> {
    await this.setState(StateKey.lastScanCompletedAt, ts, tx);
    this.log.info({ fn: 'setLastScanCompletedAt', ts }, 'Last scan completed timestamp updated');
  }

  async setLastScanStartedAt(ts: Date, tx: Prisma.TransactionClient | undefined): Promise<void> {
    await this.setState(StateKey.lastScanStartedAt, ts, tx);
    this.log.info({ fn: 'setLastScanStartedAt', ts }, 'Last scan started timestamp updated');
  }
}
