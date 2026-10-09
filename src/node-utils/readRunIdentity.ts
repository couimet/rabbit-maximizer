import pkg from '../../package.json' with { type: 'json' };
import type { RunIdentity } from '../types/index.js';
import { detectRunKind, parseImageTagNames, shortGitSha } from '../utils/index.js';

import { existsSync } from 'node:fs';

// Docker creates this file in every container it starts, so the process can
// report its runtime without any configuration.
const CONTAINER_MARKER = '/.dockerenv';

/**
 * Reads the identity of the running build. The Dockerfile and the package
 * scripts supply the values through the environment. The image carries no git
 * binary, so the commit arrives as an environment variable and only a local
 * run reads it from the working tree.
 */
export const readRunIdentity = (): RunIdentity => {
  const tagReferences = process.env.IMAGE_TAGS;
  const imageTags = tagReferences === undefined ? '' : parseImageTagNames(tagReferences);

  return {
    version: pkg.version,
    gitSha: shortGitSha(process.env.GIT_SHA),
    runKind: detectRunKind(process.env.RUN_KIND, existsSync(CONTAINER_MARKER)),
    imageTags: imageTags === '' ? 'unknown' : imageTags,
  };
};
