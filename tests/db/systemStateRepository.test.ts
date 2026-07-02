import { StateKey, type SystemStateRepository, SystemStateRepositoryImpl, VALUE_SETTER } from '../../src/db/systemStateRepository.js';
import { TYPES } from '../../src/inversify-types.js';
import { createMockLogger, createMockPrismaClient, createResolvedMock } from '../helpers/index.js';

import type { Logger } from '@couimet/logger-contract';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { Prisma, type PrismaClient } from '@prisma/client';
import { Container } from 'inversify';

describe('SystemStateRepositoryImpl', () => {
  let logger: Logger;

  beforeEach(() => {
    logger = createMockLogger();
  });

  describe('getState', () => {
    it('returns a Date for datetime keys (lastPollStartedAt)', async () => {
      const now = new Date();
      const row = {
        state_key: 'last_poll_started_at',
        value_text: null,
        value_integer: null,
        value_float: null,
        value_datetime: now.toISOString(),
        updated_at: now.toISOString(),
      };

      const { prisma, systemState } = createMockPrismaClient({
        systemState: { findUnique: createResolvedMock(row) },
      });
      const sut = new SystemStateRepositoryImpl(prisma, logger);

      const result = await sut.getState(StateKey.lastPollStartedAt);

      expect(systemState.findUnique).toHaveBeenCalledWith({ where: { state_key: 'last_poll_started_at' } });
      expect(result).toBeInstanceOf(Date);
      expect(result!.getTime()).toBe(now.getTime());
    });

    it('returns a string for text keys (lastPollOutcome)', async () => {
      const now = new Date();
      const row = {
        state_key: 'last_poll_outcome',
        value_text: 'success',
        value_integer: null,
        value_float: null,
        value_datetime: null,
        updated_at: now.toISOString(),
      };

      const { prisma, systemState } = createMockPrismaClient({
        systemState: { findUnique: createResolvedMock(row) },
      });
      const sut = new SystemStateRepositoryImpl(prisma, logger);

      const result = await sut.getState(StateKey.lastPollOutcome);

      expect(systemState.findUnique).toHaveBeenCalledWith({ where: { state_key: 'last_poll_outcome' } });
      expect(result).toBe('success');
    });

    it('returns undefined when the value column is null for an existing row', async () => {
      const row = {
        state_key: 'last_poll_started_at',
        value_text: null,
        value_integer: null,
        value_float: null,
        value_datetime: null,
        updated_at: new Date().toISOString(),
      };

      const { prisma } = createMockPrismaClient({
        systemState: { findUnique: createResolvedMock(row) },
      });
      const sut = new SystemStateRepositoryImpl(prisma, logger);

      const result = await sut.getState(StateKey.lastPollStartedAt);

      expect(result).toBeUndefined();
    });

    it('returns undefined when the key does not exist', async () => {
      const { prisma, systemState } = createMockPrismaClient({
        systemState: { findUnique: createResolvedMock(null) },
      });
      const sut = new SystemStateRepositoryImpl(prisma, logger);

      const result = await sut.getState(StateKey.schedulerStatus);

      expect(systemState.findUnique).toHaveBeenCalledWith({ where: { state_key: 'scheduler_status' } });
      expect(result).toBeUndefined();
    });
  });

  describe('setState', () => {
    it('upserts a new row with the correct value column set', async () => {
      const now = new Date('2026-06-29T12:00:00.000Z');

      const { prisma, systemState } = createMockPrismaClient({
        systemState: { upsert: jest.fn<any>() },
      });
      const sut = new SystemStateRepositoryImpl(prisma, logger);

      await sut.setState(StateKey.nextReviewAvailableAt, now);

      expect(systemState.upsert).toHaveBeenCalledWith({
        where: { state_key: 'next_review_available_at' },
        create: {
          state_key: 'next_review_available_at',
          value_text: null,
          value_integer: null,
          value_float: null,
          value_datetime: now.toISOString(),
          updated_at: expect.any(String),
        },
        update: {
          state_key: 'next_review_available_at',
          value_text: null,
          value_integer: null,
          value_float: null,
          value_datetime: now.toISOString(),
          updated_at: expect.any(String),
        },
      });
      expect(logger.debug).toHaveBeenCalledWith({ fn: 'SystemStateRepositoryImpl.setState', key: 'next_review_available_at' }, 'System state updated');
    });

    it('upserts a new row for text values', async () => {
      const { prisma, systemState } = createMockPrismaClient({
        systemState: { upsert: jest.fn<any>() },
      });
      const sut = new SystemStateRepositoryImpl(prisma, logger);

      await sut.setState(StateKey.schedulerStatus, 'running');

      expect(systemState.upsert).toHaveBeenCalledWith({
        where: { state_key: 'scheduler_status' },
        create: {
          state_key: 'scheduler_status',
          value_text: 'running',
          value_integer: null,
          value_float: null,
          value_datetime: null,
          updated_at: expect.any(String),
        },
        update: {
          state_key: 'scheduler_status',
          value_text: 'running',
          value_integer: null,
          value_float: null,
          value_datetime: null,
          updated_at: expect.any(String),
        },
      });
    });

    it('uses a transaction client when provided', async () => {
      const tx = { systemState: { upsert: jest.fn<any>().mockResolvedValue({}) } };

      const { prisma } = createMockPrismaClient();
      const sut = new SystemStateRepositoryImpl(prisma, logger);

      await sut.setState(StateKey.lastPollOutcome, 'failed', tx as unknown as Prisma.TransactionClient);

      expect(tx.systemState.upsert).toHaveBeenCalledWith({
        where: { state_key: 'last_poll_outcome' },
        create: {
          state_key: 'last_poll_outcome',
          value_text: 'failed',
          value_integer: null,
          value_float: null,
          value_datetime: null,
          updated_at: expect.any(String),
        },
        update: {
          state_key: 'last_poll_outcome',
          value_text: 'failed',
          value_integer: null,
          value_float: null,
          value_datetime: null,
          updated_at: expect.any(String),
        },
      });
    });

    it('sets updated_at to the current time', async () => {
      const now = new Date();

      const { prisma, systemState } = createMockPrismaClient({
        systemState: { upsert: jest.fn<any>() },
      });
      const sut = new SystemStateRepositoryImpl(prisma, logger);

      await sut.setState(StateKey.lastPollCompletedAt, now);

      expect(systemState.upsert).toHaveBeenCalledWith({
        where: { state_key: 'last_poll_completed_at' },
        create: {
          state_key: 'last_poll_completed_at',
          value_text: null,
          value_integer: null,
          value_float: null,
          value_datetime: now.toISOString(),
          updated_at: expect.any(String),
        },
        update: {
          state_key: 'last_poll_completed_at',
          value_text: null,
          value_integer: null,
          value_float: null,
          value_datetime: now.toISOString(),
          updated_at: expect.any(String),
        },
      });
    });
  });

  describe('VALUE_SETTER', () => {
    const base = {
      state_key: 'test',
      value_text: null,
      value_integer: null,
      value_float: null,
      value_datetime: null,
      updated_at: new Date().toISOString(),
    };

    it('value_text sets the value_text column', () => {
      const result = VALUE_SETTER.value_text(base, 'hello');
      expect(result.value_text).toBe('hello');
      expect(result.value_integer).toBeNull();
      expect(result.value_float).toBeNull();
      expect(result.value_datetime).toBeNull();
    });

    it('value_integer sets the value_integer column', () => {
      const result = VALUE_SETTER.value_integer(base, 42);
      expect(result.value_text).toBeNull();
      expect(result.value_integer).toBe(42);
      expect(result.value_float).toBeNull();
      expect(result.value_datetime).toBeNull();
    });

    it('value_float sets the value_float column', () => {
      const result = VALUE_SETTER.value_float(base, 3.14);
      expect(result.value_text).toBeNull();
      expect(result.value_integer).toBeNull();
      expect(result.value_float).toBe(3.14);
      expect(result.value_datetime).toBeNull();
    });

    it('value_datetime sets the value_datetime column as ISO string', () => {
      const now = new Date('2026-07-02T12:00:00.000Z');
      const result = VALUE_SETTER.value_datetime(base, now);
      expect(result.value_text).toBeNull();
      expect(result.value_integer).toBeNull();
      expect(result.value_float).toBeNull();
      expect(result.value_datetime).toBe('2026-07-02T12:00:00.000Z');
    });
  });

  describe('container binding', () => {
    it('resolves SystemStateRepository from the container', () => {
      const { prisma } = createMockPrismaClient();
      const container = new Container();
      container.bind<PrismaClient>(TYPES.PrismaClient).toConstantValue(prisma);
      container.bind<Logger>(TYPES.Logger).toConstantValue(logger);
      container.bind<SystemStateRepository>(TYPES.SystemStateRepository).to(SystemStateRepositoryImpl);
      expect(container.get<SystemStateRepository>(TYPES.SystemStateRepository)).toBeInstanceOf(SystemStateRepositoryImpl);
    });
  });
});
