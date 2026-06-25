import { describe, expect, it, jest } from '@jest/globals';

const { createMockVite } = await import('../helpers/index.js');
const viteMock = createMockVite();

jest.unstable_mockModule('vite', () => viteMock);

describe('setupVite', () => {
  it('sets up Vite dev server and mounts middlewares', async () => {
    const middlewares = jest.fn();
    viteMock.createServer.mockResolvedValue({ middlewares } as any);
    const { setupVite } = await import('../../src/routes/setupVite.js');
    const { createExpressApp } = await import('../../src/external-deps/couimet/express-tools/createExpressApp.js');
    const { createMockLogger } = await import('../helpers/index.js');

    const logger = createMockLogger();
    const app = createExpressApp({ logger });
    const appUse = jest.spyOn(app as any, 'use');

    await setupVite(app as any, logger, 5173, 'dashboard');

    expect(logger.info).toHaveBeenCalledWith({ fn: 'setupVite', port: 5173 }, 'Dashboard running with Vite HMR');
    expect(appUse).toHaveBeenCalledWith(middlewares);
  });

  it('logs warning when Vite fails to start', async () => {
    const viteError = new Error('Vite not found');
    viteMock.createServer.mockRejectedValue(viteError);
    const { trySetupVite } = await import('../../src/routes/setupVite.js');
    const { createMockLogger } = await import('../helpers/index.js');
    const { createExpressApp } = await import('../../src/external-deps/couimet/express-tools/createExpressApp.js');

    const logger = createMockLogger();
    const app = createExpressApp({ logger });

    trySetupVite(app as any, logger, 5173, 'dashboard');

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(logger.warn).toHaveBeenCalledWith({ fn: 'trySetupVite', error: viteError }, 'Vite dev server not available (dashboard directory may not exist yet)');
  });
});
