import { CoderabbitCommentClassifier } from '../../src/github/index.js';
import type { Config } from '../../src/schemas/index.js';

import { createCoderabbitMarkers } from './CoderabbitMarkersTestSupport.js';

/** @testFixture */
export const createCoderabbitCommentClassifier = (overrides?: Partial<Config>): CoderabbitCommentClassifier =>
  new CoderabbitCommentClassifier(createCoderabbitMarkers(overrides));
