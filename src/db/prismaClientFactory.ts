import { config } from '../config.js';
import { RabbitMaximizerError } from '../errors/RabbitMaximizerError.js';
import { RabbitMaximizerErrorCodes } from '../errors/RabbitMaximizerErrorCodes.js';

import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaClient } from '@prisma/client';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

const FILE_URL_PREFIX = 'file:';

/**
 * The SQLite file location is dictated entirely by DATABASE_URL (the npm scripts
 * set it to an absolute path from $PWD). We open that url as-is and only make
 * sure its parent directory exists, so there is no path resolution in code.
 */
const createFromFile = (url: string): PrismaClient => {
  const filePath = url.slice(FILE_URL_PREFIX.length);
  mkdirSync(path.dirname(filePath), { recursive: true });

  const adapter = new PrismaBetterSqlite3({ url });
  return new PrismaClient({ adapter });
};

export const createPrismaClient = (): PrismaClient => {
  const url = config.DATABASE_URL;
  if (!url.startsWith(FILE_URL_PREFIX)) {
    const [scheme] = url.split(':');
    throw new RabbitMaximizerError({
      code: RabbitMaximizerErrorCodes.PRISMA_CONNECTION_METHOD_NOT_SUPPORTED,
      message: 'Unsupported DATABASE_URL connection method; only "file:" URLs are supported',
      functionName: 'createPrismaClient',
      details: { scheme },
    });
  }
  return createFromFile(url);
};
