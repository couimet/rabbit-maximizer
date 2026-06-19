import { jest, describe, it, expect } from "@jest/globals";
import path from "node:path";

const mkdirSync = jest.fn();
const PrismaClientCtor = jest.fn();
const PrismaBetterSqlite3Ctor = jest.fn();

const config = { DATABASE_URL: "file:./data/rabbit-optimizer.db" };

jest.unstable_mockModule("node:fs", () => ({ mkdirSync }));
jest.unstable_mockModule("@prisma/client", () => ({
  PrismaClient: PrismaClientCtor,
}));
jest.unstable_mockModule("@prisma/adapter-better-sqlite3", () => ({
  PrismaBetterSqlite3: PrismaBetterSqlite3Ctor,
}));
jest.unstable_mockModule("../../src/config.js", () => ({ config }));

const { createPrismaClient } =
  await import("../../src/db/prismaClientFactory.js");

describe("createPrismaClient", () => {
  it("creates the parent directory and opens the configured file url as-is", () => {
    config.DATABASE_URL = "file:/tmp/rabbit-optimizer/db.sqlite";

    createPrismaClient();

    expect(mkdirSync).toHaveBeenCalledWith(
      path.dirname("/tmp/rabbit-optimizer/db.sqlite"),
      { recursive: true },
    );
    expect(PrismaBetterSqlite3Ctor).toHaveBeenCalledWith({
      url: "file:/tmp/rabbit-optimizer/db.sqlite",
    });
    const [adapterInstance] = PrismaBetterSqlite3Ctor.mock.instances;
    expect(PrismaClientCtor).toHaveBeenCalledWith({
      adapter: adapterInstance,
    });
  });

  it("throws PRISMA_CONNECTION_METHOD_NOT_SUPPORTED for a non-file: url", () => {
    config.DATABASE_URL = "postgresql://user:pass@localhost:5432/db";

    expect(() => createPrismaClient()).toThrowRabbitOptimizerError(
      "PRISMA_CONNECTION_METHOD_NOT_SUPPORTED",
      {
        message:
          'Unsupported DATABASE_URL connection method; only "file:" URLs are supported',
        functionName: "createPrismaClient",
        details: { scheme: "postgresql" },
      },
    );

    expect(mkdirSync).not.toHaveBeenCalled();
    expect(PrismaBetterSqlite3Ctor).not.toHaveBeenCalled();
    expect(PrismaClientCtor).not.toHaveBeenCalled();
  });
});
