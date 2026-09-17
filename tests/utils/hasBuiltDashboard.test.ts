import { hasBuiltDashboard } from '../../src/utils/hasBuiltDashboard.js';

import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

describe('hasBuiltDashboard', () => {
  let builtDir: string;
  let emptyDir: string;
  let indexAsDir: string;

  beforeAll(async () => {
    builtDir = await mkdtemp(path.join(tmpdir(), 'rabbit-maximizer-built-'));
    await writeFile(path.join(builtDir, 'index.html'), '<!doctype html><html lang="en"></html>');
    emptyDir = await mkdtemp(path.join(tmpdir(), 'rabbit-maximizer-empty-'));
    indexAsDir = await mkdtemp(path.join(tmpdir(), 'rabbit-maximizer-index-dir-'));
    await mkdir(path.join(indexAsDir, 'index.html'));
  });

  afterAll(async () => {
    await rm(builtDir, { recursive: true, force: true });
    await rm(emptyDir, { recursive: true, force: true });
    await rm(indexAsDir, { recursive: true, force: true });
  });

  it('returns true when the directory holds an index.html', () => {
    expect(hasBuiltDashboard(builtDir)).toBe(true);
  });

  it('returns false when the directory holds no index.html', () => {
    expect(hasBuiltDashboard(emptyDir)).toBe(false);
  });

  it('returns false when index.html is a directory', () => {
    expect(hasBuiltDashboard(indexAsDir)).toBe(false);
  });

  it('returns false when the directory does not exist', () => {
    expect(hasBuiltDashboard(path.join(emptyDir, 'missing'))).toBe(false);
  });
});
