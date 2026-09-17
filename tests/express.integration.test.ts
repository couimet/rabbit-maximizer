import { setupExpress } from '../src/express.js';
import { EventCountsMapper, EventEntryMapper, QueueItemMapper, TrackedPrMapper } from '../src/mappers/index.js';
import { hasBuiltDashboard } from '../src/utils/hasBuiltDashboard.js';

import { fetchResponse } from './helpers/fetchResponse.js';
import {
  createMockActivityListMapper,
  createMockEventRepo,
  createMockPullRequestRepo,
  createMockQueueItemEnricher,
  createMockQueueOrderRepo,
  createMockQueueRepo,
  createMockSystemStateRepository,
  EXPECTED_CSP_WITHOUT_UPGRADE_INSECURE_REQUESTS,
} from './helpers/index.js';

import { createMockLogger } from '@couimet/logger-contract-testing';
import { afterAll, beforeAll, describe, expect, it, jest } from '@jest/globals';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DASHBOARD_DIR = path.join(REPO_ROOT, 'dist', 'dashboard');
const BUILT_DASHBOARD_DIR = path.join(DASHBOARD_DIR, 'dist');

describe('setupExpress in production', () => {
  let port: number;
  let stop: () => Promise<void>;
  let previousNodeEnv: string | undefined;

  beforeAll(async () => {
    if (!hasBuiltDashboard(BUILT_DASHBOARD_DIR)) {
      throw new Error(`The dashboard build is missing at ${BUILT_DASHBOARD_DIR}. Run 'pnpm build' first.`);
    }

    previousNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    const app = await setupExpress({
      activityListMapper: createMockActivityListMapper(),
      config: { SCHEDULER_TICK_INTERVAL_SEC: 10 } as any,
      dashboardDir: DASHBOARD_DIR,
      eventCountsMapper: new EventCountsMapper(),
      eventEntryMapper: new EventEntryMapper(),
      queueItemMapper: new QueueItemMapper(createMockQueueItemEnricher()),
      queueRepo: createMockQueueRepo(),
      queueOrderRepo: createMockQueueOrderRepo(),
      eventRepo: createMockEventRepo(),
      prisma: {} as any,
      reviewTrigger: { trigger: jest.fn() } as any,
      systemStateRepo: createMockSystemStateRepository(),
      pullRequestRepo: createMockPullRequestRepo(),
      trackedPrMapper: new TrackedPrMapper(),
      logger: createMockLogger(),
      port: 0,
    });
    stop = app.stop;
    port = app.port;
  });

  afterAll(async () => {
    process.env.NODE_ENV = previousNodeEnv;
    if (stop) await stop();
  });

  it('serves the built dashboard shell on /', async () => {
    const res = await fetchResponse(port, '/');

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('text/html; charset=utf-8');
    expect(await res.text()).toContain('<div id="root"></div>');
  });

  it('serves a public asset while the working directory is elsewhere', async () => {
    const currentDir = process.cwd();
    const elsewhere = await mkdtemp(path.join(tmpdir(), 'rabbit-maximizer-cwd-'));
    process.chdir(elsewhere);

    try {
      const res = await fetchResponse(port, '/favicon-32.png');

      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toBe('image/png');
    } finally {
      process.chdir(currentDir);
      await rm(elsewhere, { recursive: true, force: true });
    }
  });

  it('drops the upgrade-insecure-requests directive from the CSP header', async () => {
    const res = await fetchResponse(port, '/');

    expect(res.headers.get('content-security-policy')).toBe(EXPECTED_CSP_WITHOUT_UPGRADE_INSECURE_REQUESTS);
  });
});
