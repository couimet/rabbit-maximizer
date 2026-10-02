import { detectRunKind } from '../../src/utils/detectRunKind.js';

import { getUniqueString } from '@couimet/dynamic-testing';
import { beforeEach, describe, expect, it } from '@jest/globals';

describe('detectRunKind', () => {
  let declaredKind: string;

  beforeEach(() => {
    declaredKind = getUniqueString({ prefix: 'run-kind-' });
  });

  it('returns the declared kind', () => {
    expect(detectRunKind(declaredKind, false)).toBe(declaredKind);
  });

  it('prefers the declared kind over the container marker', () => {
    expect(detectRunKind(declaredKind, true)).toBe(declaredKind);
  });

  it('detects a container when the value is absent', () => {
    expect(detectRunKind(undefined, true)).toBe('docker');
  });

  it('returns unknown when the value is absent and no container marker is present', () => {
    expect(detectRunKind(undefined, false)).toBe('unknown');
  });

  it('returns unknown when the value is blank', () => {
    expect(detectRunKind('  ', false)).toBe('unknown');
  });
});
