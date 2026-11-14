import { CoderabbitCommentClassifier, RefusalPhrases } from '../../src/github/index.js';
import type { Config } from '../../src/schemas/index.js';

import { generateConfigData } from './ConfigTestSupport.js';

/** @testFixture */
export const createCoderabbitCommentClassifier = (overrides?: Partial<Config>): CoderabbitCommentClassifier =>
  new CoderabbitCommentClassifier(new RefusalPhrases(generateConfigData(overrides)));
