import pkg from '../../package.json' with { type: 'json' };
import { readRunIdentity } from '../../src/utils/readRunIdentity.js';

import { getRandomHexString, getUniqueString } from '@couimet/dynamic-testing';
import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import { existsSync } from 'node:fs';

const SHORT_SHA_LENGTH = 7;
const FULL_SHA_LENGTH = 40;
const IDENTITY_VARIABLES = ['GIT_SHA', 'RUN_KIND', 'IMAGE_TAGS'] as const;
const CONTAINER_MARKER = '/.dockerenv';

// The suite runs on a laptop and on a CI runner, where the marker is absent,
// and inside a container, where Docker creates it.
const EXPECTED_DETECTED_RUN_KIND = existsSync(CONTAINER_MARKER) ? 'docker' : 'unknown';

describe('readRunIdentity', () => {
  let declaredValues: Map<string, string | undefined>;
  let shortSha: string;
  let fullSha: string;
  let imageRepo: string;
  let runKind: string;
  let versionTag: string;
  let shortShaTag: string;

  beforeEach(() => {
    declaredValues = new Map(IDENTITY_VARIABLES.map((name) => [name, process.env[name]]));

    for (const name of IDENTITY_VARIABLES) {
      delete process.env[name];
    }

    shortSha = getRandomHexString(SHORT_SHA_LENGTH);
    fullSha = `${shortSha}${getRandomHexString(FULL_SHA_LENGTH - SHORT_SHA_LENGTH)}`;
    imageRepo = getUniqueString({ prefix: 'ghcr.io/owner/repo-' });
    runKind = getUniqueString({ prefix: 'run-kind-' });
    versionTag = getUniqueString({ prefix: 'tag-' });
    shortShaTag = getUniqueString({ prefix: 'sha-' });
  });

  afterEach(() => {
    for (const [name, value] of declaredValues) {
      if (value === undefined) {
        delete process.env[name];
      } else {
        process.env[name] = value;
      }
    }
  });

  it('reports the values the environment declares', () => {
    process.env.GIT_SHA = fullSha;
    process.env.RUN_KIND = runKind;
    process.env.IMAGE_TAGS = `${imageRepo}:${versionTag},${imageRepo}:${shortShaTag}`;

    expect(readRunIdentity()).toStrictEqual({
      version: pkg.version,
      gitSha: shortSha,
      runKind,
      imageTags: `${versionTag},${shortShaTag}`,
    });
  });

  it('reports unknown for every value the environment does not declare', () => {
    expect(readRunIdentity()).toStrictEqual({
      version: pkg.version,
      gitSha: 'unknown',
      runKind: EXPECTED_DETECTED_RUN_KIND,
      imageTags: 'unknown',
    });
  });
});
