import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { Container } from "inversify";
import type { Logger } from "@couimet/logger-contract";
import { Prisma, type PrismaClient } from "@prisma/client";
import {
  QueueRepositoryImpl,
  type QueueRepository,
} from "../../src/db/queueRepository.js";
import { QueueStatus } from "../../src/types/index.js";
import { TYPES } from "../../src/inversify-types.js";
import {
  createMockPrismaClient,
  createMockLogger,
  createResolvedMock,
  makeUniqueRepoName,
} from "../helpers/index.js";
import {
  getUniqueInt,
  getUniqueDate,
  getUniqueString,
} from "@couimet/dynamic-testing";

interface RowOverrides {
  id?: number;
  repo_full_name?: string;
  pr_number?: number;
  status?: string;
  scheduled_for?: Date;
  attempts?: number;
}

const makeRow = (over: RowOverrides = {}) => ({
  id: over.id ?? getUniqueInt(),
  uuid: getUniqueString({ prefix: "uuid-" }),
  repo_full_name: over.repo_full_name ?? makeUniqueRepoName().fullName,
  pr_number: over.pr_number ?? getUniqueInt(),
  status: over.status ?? "pending",
  scheduled_for: over.scheduled_for ?? getUniqueDate(),
  attempts: over.attempts ?? 0,
  created_at: getUniqueDate(),
  updated_at: getUniqueDate(),
});

const toExpectedItem = (row: ReturnType<typeof makeRow>) => ({
  id: row.id,
  uuid: row.uuid,
  repo_full_name: row.repo_full_name,
  pr_number: row.pr_number,
  status: row.status as QueueStatus,
  scheduled_for: row.scheduled_for,
  attempts: row.attempts,
  created_at: row.created_at,
  updated_at: row.updated_at,
});

describe("QueueRepositoryImpl", () => {
  let frozenNow: Date;

  beforeEach(() => {
    frozenNow = getUniqueDate();
    jest.useFakeTimers();
    jest.setSystemTime(frozenNow);
  });

  describe("enqueue", () => {
    it("creates a pending row and returns it", async () => {
      const { fullName: repo } = makeUniqueRepoName();
      const pr = getUniqueInt();
      const scheduledFor = getUniqueDate();
      const row = makeRow({ repo_full_name: repo, pr_number: pr });

      const { prisma, reviewQueue } = createMockPrismaClient({
        reviewQueue: { create: createResolvedMock(row) },
      });
      const logger = createMockLogger();
      const sut = new QueueRepositoryImpl(prisma, logger);

      const result = await sut.enqueue(repo, pr, scheduledFor);

      expect(reviewQueue.create).toHaveBeenCalledWith({
        data: {
          repo_full_name: repo,
          pr_number: pr,
          scheduled_for: scheduledFor,
        },
      });
      expect(result).toStrictEqual(toExpectedItem(row));
      expect(logger.debug).toHaveBeenCalledWith(
        { fn: "QueueRepositoryImpl.enqueue", repo, pr },
        "Enqueued review",
      );
    });

    it("returns the existing pending row when the PR is already queued (P2002)", async () => {
      const { fullName: repo } = makeUniqueRepoName();
      const pr = getUniqueInt();
      const existing = makeRow({
        repo_full_name: repo,
        pr_number: pr,
        status: "pending",
      });
      const p2002 = new Prisma.PrismaClientKnownRequestError(
        "Unique constraint",
        {
          code: "P2002",
          clientVersion: "7.8.0",
        },
      );

      const { prisma, reviewQueue } = createMockPrismaClient({
        reviewQueue: {
          create: jest.fn<any>().mockRejectedValue(p2002),
          findFirst: createResolvedMock(existing),
        },
      });
      const logger = createMockLogger();
      const sut = new QueueRepositoryImpl(prisma, logger);

      const result = await sut.enqueue(repo, pr, getUniqueDate());

      expect(reviewQueue.findFirst).toHaveBeenCalledWith({
        where: { repo_full_name: repo, pr_number: pr, status: "pending" },
      });
      expect(result).toStrictEqual(toExpectedItem(existing));
      expect(logger.debug).toHaveBeenCalledWith(
        { fn: "QueueRepositoryImpl.enqueue", repo, pr },
        "Already queued; returning existing pending row",
      );
    });

    it("rethrows a P2002 when no pending row is found", async () => {
      const { fullName: repo } = makeUniqueRepoName();
      const pr = getUniqueInt();
      const p2002 = new Prisma.PrismaClientKnownRequestError(
        "Unique constraint",
        {
          code: "P2002",
          clientVersion: "7.8.0",
        },
      );

      const { prisma } = createMockPrismaClient({
        reviewQueue: {
          create: jest.fn<any>().mockRejectedValue(p2002),
          findFirst: createResolvedMock(null),
        },
      });
      const sut = new QueueRepositoryImpl(prisma, createMockLogger());

      await expect(sut.enqueue(repo, pr, getUniqueDate())).rejects.toBe(p2002);
    });

    it("rethrows a known request error with a different code", async () => {
      const p2003 = new Prisma.PrismaClientKnownRequestError("FK constraint", {
        code: "P2003",
        clientVersion: "7.8.0",
      });
      const { prisma } = createMockPrismaClient({
        reviewQueue: { create: jest.fn<any>().mockRejectedValue(p2003) },
      });
      const sut = new QueueRepositoryImpl(prisma, createMockLogger());

      await expect(
        sut.enqueue(
          makeUniqueRepoName().fullName,
          getUniqueInt(),
          getUniqueDate(),
        ),
      ).rejects.toBe(p2003);
    });

    it("rethrows a non-Prisma error", async () => {
      const boom = new Error("boom");
      const { prisma } = createMockPrismaClient({
        reviewQueue: { create: jest.fn<any>().mockRejectedValue(boom) },
      });
      const sut = new QueueRepositoryImpl(prisma, createMockLogger());

      await expect(
        sut.enqueue(
          makeUniqueRepoName().fullName,
          getUniqueInt(),
          getUniqueDate(),
        ),
      ).rejects.toBe(boom);
    });
  });

  describe("getNextDue", () => {
    it("returns the earliest due pending item", async () => {
      const row = makeRow({ status: "pending" });
      const { prisma, reviewQueue } = createMockPrismaClient({
        reviewQueue: { findFirst: createResolvedMock(row) },
      });
      const logger = createMockLogger();
      const sut = new QueueRepositoryImpl(prisma, logger);

      const result = await sut.getNextDue();

      expect(reviewQueue.findFirst).toHaveBeenCalledWith({
        where: { status: "pending", scheduled_for: { lte: frozenNow } },
        orderBy: { scheduled_for: "asc" },
      });
      expect(result).toStrictEqual(toExpectedItem(row));
      expect(logger.debug).toHaveBeenCalledWith(
        { fn: "QueueRepositoryImpl.getNextDue", found: true },
        "Fetched next due review",
      );
    });

    it("returns null when nothing is due", async () => {
      const { prisma, reviewQueue } = createMockPrismaClient({
        reviewQueue: { findFirst: createResolvedMock(null) },
      });
      const logger = createMockLogger();
      const sut = new QueueRepositoryImpl(prisma, logger);

      const result = await sut.getNextDue();

      expect(result).toBeNull();
      expect(reviewQueue.findFirst).toHaveBeenCalledWith({
        where: { status: "pending", scheduled_for: { lte: frozenNow } },
        orderBy: { scheduled_for: "asc" },
      });
      expect(logger.debug).toHaveBeenCalledWith(
        { fn: "QueueRepositoryImpl.getNextDue", found: false },
        "Fetched next due review",
      );
    });
  });

  describe("markCompleted", () => {
    it("updates the row to completed", async () => {
      const row = makeRow({ status: "completed" });
      const { prisma, reviewQueue } = createMockPrismaClient({
        reviewQueue: { update: createResolvedMock(row) },
      });
      const logger = createMockLogger();
      const sut = new QueueRepositoryImpl(prisma, logger);

      const result = await sut.markCompleted(row.id);

      expect(reviewQueue.update).toHaveBeenCalledWith({
        where: { id: row.id },
        data: { status: "completed" },
      });
      expect(result).toStrictEqual(toExpectedItem(row));
      expect(logger.debug).toHaveBeenCalledWith(
        { fn: "QueueRepositoryImpl.markCompleted", id: row.id },
        "Marked review completed",
      );
    });
  });

  describe("reschedule", () => {
    it("increments attempts and updates the scheduled time", async () => {
      const newScheduledFor = getUniqueDate();
      const row = makeRow({ attempts: 1, scheduled_for: newScheduledFor });
      const { prisma, reviewQueue } = createMockPrismaClient({
        reviewQueue: { update: createResolvedMock(row) },
      });
      const logger = createMockLogger();
      const sut = new QueueRepositoryImpl(prisma, logger);

      const result = await sut.reschedule(row.id, newScheduledFor);

      expect(reviewQueue.update).toHaveBeenCalledWith({
        where: { id: row.id },
        data: { attempts: { increment: 1 }, scheduled_for: newScheduledFor },
      });
      expect(result).toStrictEqual(toExpectedItem(row));
      expect(logger.debug).toHaveBeenCalledWith(
        { fn: "QueueRepositoryImpl.reschedule", id: row.id },
        "Rescheduled review",
      );
    });
  });

  describe("markFailed", () => {
    it("updates the row to failed", async () => {
      const row = makeRow({ status: "failed" });
      const { prisma, reviewQueue } = createMockPrismaClient({
        reviewQueue: { update: createResolvedMock(row) },
      });
      const logger = createMockLogger();
      const sut = new QueueRepositoryImpl(prisma, logger);

      const result = await sut.markFailed(row.id);

      expect(reviewQueue.update).toHaveBeenCalledWith({
        where: { id: row.id },
        data: { status: "failed" },
      });
      expect(result).toStrictEqual(toExpectedItem(row));
      expect(logger.debug).toHaveBeenCalledWith(
        { fn: "QueueRepositoryImpl.markFailed", id: row.id },
        "Marked review failed",
      );
    });
  });

  describe("getPendingQueue", () => {
    it("returns pending items ordered by scheduled time", async () => {
      const rows = [
        makeRow({ status: "pending" }),
        makeRow({ status: "pending" }),
      ];
      const { prisma, reviewQueue } = createMockPrismaClient({
        reviewQueue: { findMany: createResolvedMock(rows) },
      });
      const logger = createMockLogger();
      const sut = new QueueRepositoryImpl(prisma, logger);

      const result = await sut.getPendingQueue();

      expect(reviewQueue.findMany).toHaveBeenCalledWith({
        where: { status: "pending" },
        orderBy: { scheduled_for: "asc" },
      });
      expect(result).toStrictEqual(rows.map(toExpectedItem));
      expect(logger.debug).toHaveBeenCalledWith(
        { fn: "QueueRepositoryImpl.getPendingQueue", count: 2 },
        "Fetched pending queue",
      );
    });
  });

  describe("transaction client", () => {
    it("uses the provided transaction client for mutations", async () => {
      const row = makeRow({ status: "completed" });
      const tx = createMockPrismaClient({
        reviewQueue: { update: createResolvedMock(row) },
      });
      const base = createMockPrismaClient();
      const logger = createMockLogger();
      const sut = new QueueRepositoryImpl(base.prisma, logger);

      const result = await sut.markCompleted(
        row.id,
        tx.prisma as unknown as Prisma.TransactionClient,
      );

      expect(tx.reviewQueue.update).toHaveBeenCalledWith({
        where: { id: row.id },
        data: { status: "completed" },
      });
      expect(base.reviewQueue.update).not.toHaveBeenCalled();
      expect(result).toStrictEqual(toExpectedItem(row));
      expect(logger.debug).toHaveBeenCalledWith(
        { fn: "QueueRepositoryImpl.markCompleted", id: row.id },
        "Marked review completed",
      );
    });
  });

  describe("container binding", () => {
    it("resolves QueueRepository from the container", () => {
      const { prisma } = createMockPrismaClient();
      const logger = createMockLogger();
      const container = new Container();

      container.bind<PrismaClient>(TYPES.PrismaClient).toConstantValue(prisma);
      container.bind<Logger>(TYPES.Logger).toConstantValue(logger);
      container
        .bind<QueueRepository>(TYPES.QueueRepository)
        .to(QueueRepositoryImpl);

      const repo = container.get<QueueRepository>(TYPES.QueueRepository);
      expect(repo).toBeInstanceOf(QueueRepositoryImpl);
    });
  });
});
