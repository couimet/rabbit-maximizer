import { CoderabbitMarkers } from '../../src/github/index.js';
import type { Config } from '../../src/schemas/index.js';

import { generateConfigData } from './ConfigTestSupport.js';

/** @testFixture */
export const createCoderabbitMarkers = (overrides?: Partial<Config>): CoderabbitMarkers => new CoderabbitMarkers(generateConfigData(overrides));
