import { describe, it, expect } from "@jest/globals";
import { Container } from "inversify";
import type { Logger } from "@couimet/logger-contract";
import type { Prisma, PrismaClient } from "@prisma/client";
import {
  EventRepositoryImpl,
  type EventRepository,
  type NewEvent,
} from "../../src/db/eventRepository.js";
import { EventType } from "../../src/types/index.js";
import { TYPES } from "../../src/inversify-types.js";
import {
  createMockPrismaClient,
  createMockLogger,
  createResolvedMock,
  makeUniqueRepoName,
} from "../helpers/index.js";
import {
  getUniqueInt,
  getUniqueString,
  getUniqueDate,
} from "@couimet/dynamic-testing";

describe("EventRepositoryImpl", () => {
  describe("record", () => {
    it("inserts a detected event and returns the parsed entry", async () => {
      const { fullName: repo } = makeUniqueRepoName();
      const pr = getUniqueInt();
      const correlationId = getUniqueString({ prefix: "corr-" });
      const requestId = getUniqueString({ prefix: "req-" });
      const version = getUniqueString({ prefix: "v" });
      const sourceCommentUrl = getUniqueString({ prefix: "https://gh/c/" });
      const id = getUniqueInt();
      const uuid = getUniqueString({ prefix: "uuid-" });
      const ts = getUniqueDate();

      const storedRow = {
        id,
        uuid,
        ts,
        type: "detected",
        repo_full_name: repo,
        pr_number: pr,
        correlation_id: correlationId,
        request_id: requestId,
        version,
        payload: JSON.stringify({ source_comment_url: sourceCommentUrl }),
        metadata: null,
      };

      const { prisma, event } = createMockPrismaClient({
        event: { create: createResolvedMock(storedRow) },
      });
      const logger = createMockLogger();
      const sut = new EventRepositoryImpl(prisma, logger);

      const input: NewEvent = {
        type: EventType.detected,
        repo_full_name: repo,
        pr_number: pr,
        correlation_id: correlationId,
        request_id: requestId,
        version,
        payload: { source_comment_url: sourceCommentUrl },
      };
      const result = await sut.record(input);

      expect(event.create).toHaveBeenCalledWith({
        data: {
          type: "detected",
          repo_full_name: repo,
          pr_number: pr,
          correlation_id: correlationId,
          request_id: requestId,
          version,
          payload: JSON.stringify({ source_comment_url: sourceCommentUrl }),
          metadata: null,
        },
      });
      expect(result).toStrictEqual({
        id,
        uuid,
        ts,
        type: "detected",
        repo_full_name: repo,
        pr_number: pr,
        correlation_id: correlationId,
        request_id: requestId,
        version,
        metadata: undefined,
        payload: { source_comment_url: sourceCommentUrl },
      });
      expect(logger.debug).toHaveBeenCalledWith(
        { fn: "EventRepositoryImpl.record", type: "detected", repo, pr },
        "Event recorded",
      );
    });

    it("writes through the transaction client and serializes metadata", async () => {
      const { fullName: repo } = makeUniqueRepoName();
      const pr = getUniqueInt();
      const correlationId = getUniqueString({ prefix: "corr-" });
      const version = getUniqueString({ prefix: "v" });
      const reason = getUniqueString({ prefix: "reason-" });
      const metadata = {
        git_sha: getUniqueString(),
        host: getUniqueString(),
      };
      const ts = getUniqueDate();

      const storedRow = {
        id: getUniqueInt(),
        uuid: getUniqueString(),
        ts,
        type: "failed",
        repo_full_name: repo,
        pr_number: pr,
        correlation_id: correlationId,
        request_id: null,
        version,
        payload: JSON.stringify({ reason }),
        metadata: JSON.stringify(metadata),
      };

      const tx = createMockPrismaClient({
        event: { create: createResolvedMock(storedRow) },
      });
      const base = createMockPrismaClient();
      const logger = createMockLogger();
      const sut = new EventRepositoryImpl(base.prisma, logger);

      const result = await sut.record(
        {
          type: EventType.failed,
          repo_full_name: repo,
          pr_number: pr,
          correlation_id: correlationId,
          version,
          metadata,
          payload: { reason },
        },
        tx.prisma as unknown as Prisma.TransactionClient,
      );

      expect(tx.event.create).toHaveBeenCalledWith({
        data: {
          type: "failed",
          repo_full_name: repo,
          pr_number: pr,
          correlation_id: correlationId,
          request_id: null,
          version,
          payload: JSON.stringify({ reason }),
          metadata: JSON.stringify(metadata),
        },
      });
      expect(base.event.create).not.toHaveBeenCalled();
      expect(result.metadata).toStrictEqual(metadata);
      expect(result.request_id).toBeUndefined();
      expect(logger.debug).toHaveBeenCalledWith(
        { fn: "EventRepositoryImpl.record", type: "failed", repo, pr },
        "Event recorded",
      );
    });
  });

  describe("listForPr", () => {
    it("returns events for a PR ordered by ts", async () => {
      const { fullName: repo } = makeUniqueRepoName();
      const pr = getUniqueInt();
      const detectedUrl = getUniqueString({ prefix: "https://gh/c/" });
      const scheduledFor = getUniqueDate();

      const detectedRow = {
        id: getUniqueInt(),
        uuid: getUniqueString(),
        ts: getUniqueDate(),
        type: "detected",
        repo_full_name: repo,
        pr_number: pr,
        correlation_id: getUniqueString(),
        request_id: null,
        version: getUniqueString(),
        payload: JSON.stringify({ source_comment_url: detectedUrl }),
        metadata: null,
      };
      const enqueuedRow = {
        id: getUniqueInt(),
        uuid: getUniqueString(),
        ts: getUniqueDate(),
        type: "enqueued",
        repo_full_name: repo,
        pr_number: pr,
        correlation_id: getUniqueString(),
        request_id: null,
        version: getUniqueString(),
        payload: JSON.stringify({
          scheduled_for: scheduledFor.toISOString(),
          attempt_no: 1,
        }),
        metadata: null,
      };

      const { prisma, event } = createMockPrismaClient({
        event: { findMany: createResolvedMock([detectedRow, enqueuedRow]) },
      });
      const logger = createMockLogger();
      const sut = new EventRepositoryImpl(prisma, logger);

      const result = await sut.listForPr(repo, pr);

      expect(event.findMany).toHaveBeenCalledWith({
        where: { repo_full_name: repo, pr_number: pr },
        orderBy: { ts: "asc" },
      });
      expect(result).toStrictEqual([
        {
          id: detectedRow.id,
          uuid: detectedRow.uuid,
          ts: detectedRow.ts,
          repo_full_name: repo,
          pr_number: pr,
          correlation_id: detectedRow.correlation_id,
          request_id: undefined,
          version: detectedRow.version,
          metadata: undefined,
          type: "detected",
          payload: { source_comment_url: detectedUrl },
        },
        {
          id: enqueuedRow.id,
          uuid: enqueuedRow.uuid,
          ts: enqueuedRow.ts,
          repo_full_name: repo,
          pr_number: pr,
          correlation_id: enqueuedRow.correlation_id,
          request_id: undefined,
          version: enqueuedRow.version,
          metadata: undefined,
          type: "enqueued",
          payload: { scheduled_for: scheduledFor, attempt_no: 1 },
        },
      ]);
      expect(logger.debug).toHaveBeenCalledWith(
        { fn: "EventRepositoryImpl.listForPr", repo, pr, count: 2 },
        "Listed events for PR",
      );
    });
  });

  describe("container binding", () => {
    it("resolves EventRepository from the container", () => {
      const { prisma } = createMockPrismaClient();
      const logger = createMockLogger();
      const container = new Container();

      container.bind<PrismaClient>(TYPES.PrismaClient).toConstantValue(prisma);
      container.bind<Logger>(TYPES.Logger).toConstantValue(logger);
      container
        .bind<EventRepository>(TYPES.EventRepository)
        .to(EventRepositoryImpl);

      const repo = container.get<EventRepository>(TYPES.EventRepository);
      expect(repo).toBeInstanceOf(EventRepositoryImpl);
    });
  });
});
