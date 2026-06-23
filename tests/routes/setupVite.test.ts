import { jest, describe, expect, it } from '@jest/globals';

jest.unstable_mockModule('vite', () => ({
  createServer: jest.fn().mockResolvedValue({ middlewares: jest.fn() }),
}));

describe('setupVite', () => {
  it('sets up Vite dev server and mounts middlewares', async () => {
    const { setupVite } = await import('../../src/routes/setupVite.js');
    const { createExpressApp } = await import('../../src/external-deps/couimet/express-tools/createExpressApp.js');
    const { createMockLogger } = await import('../helpers/index.js');

    const logger = createMockLogger();
    const app = createExpressApp({ logger });

    await setupVite(app, logger, 5173);

    expect(logger.info).toHaveBeenCalledWith({ fn: 'setupExpress', port: 5173 }, 'Dashboard running with Vite HMR');
  });
});
