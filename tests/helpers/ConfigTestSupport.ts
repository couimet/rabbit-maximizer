import { type Config, ConfigSchema } from '../../src/schemas/index.js';

export const generateConfigData = (overrides?: Partial<Config>): Config =>
  ConfigSchema.parse({
    GITHUB_PAT: 'ghp_fake',
    REPO_FILTER: [{ pattern: 'couimet/*', scope: 'user' }],
    ...overrides,
  });
