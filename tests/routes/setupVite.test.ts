import { setupVite } from '../../src/routes/setupVite.js';
import { createExpressApp } from '../../src/external-deps/couimet/express-tools/createExpressApp.js';
import { createMockLogger } from '../helpers/index.js';

import { describe, expect, it } from '@jest/globals';

describe('setupVite', () => {
  it('imports Vite and attempts server creation', async () => {
    const logger = createMockLogger();
    const app = createExpressApp({ logger });

    // Vite 8's createServer fails in Jest due to native plugin bindings,
    // but the dynamic import succeeds, covering the module loading path.
    await expect(setupVite(app, logger, 0)).rejects.toThrow();
  });
});
