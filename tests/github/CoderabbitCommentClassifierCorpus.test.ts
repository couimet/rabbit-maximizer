import type { CodeRabbitCommentType } from '../../src/domain.js';
import { createCoderabbitCommentClassifier } from '../helpers/index.js';

import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/** A captured CodeRabbit comment body and the classification the shipped phrases must produce for it. */
interface CorpusEntry {
  readonly file: string;
  /** The comment that the body comes from, so a reader can check the capture. */
  readonly sourceCommentUrl: string;
  readonly expected: {
    readonly classification: CodeRabbitCommentType;
    /** `null` when no configured phrase appears in the body. */
    readonly matchedPhrase: string | null;
    /** `null` when no configured phrase appears in the body. */
    readonly matchedOffset: number | null;
  };
}

const FIXTURES_ROOT = join(process.cwd(), 'tests', 'fixtures', 'coderabbit-bodies');
const CORPUS = JSON.parse(readFileSync(join(FIXTURES_ROOT, 'manifest.json'), 'utf8')) as readonly CorpusEntry[];

/**
 * Prove the shipped phrase defaults against real comment bodies. Each fixture holds one
 * captured body, and the manifest names the classification and the match that the body
 * must produce. The classifier takes the generated config, so a default that stops
 * matching a real body fails here.
 */
describe('CoderabbitCommentClassifier corpus', () => {
  const classifier = createCoderabbitCommentClassifier();

  for (const entry of CORPUS) {
    describe(entry.file, () => {
      const body = readFileSync(join(FIXTURES_ROOT, entry.file), 'utf8');

      it('classifies the captured body', () => {
        expect(classifier.classify(body)).toStrictEqual({
          classification: entry.expected.classification,
          matchedPhrase: entry.expected.matchedPhrase ?? undefined,
          matchedOffset: entry.expected.matchedOffset ?? undefined,
        });
      });

      it('names the offset where the captured body really holds the phrase', () => {
        expect(entry.expected.matchedPhrase === null ? null : body.indexOf(entry.expected.matchedPhrase)).toBe(entry.expected.matchedOffset);
      });
    });
  }
});
