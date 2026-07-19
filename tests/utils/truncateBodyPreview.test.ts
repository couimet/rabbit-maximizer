import { truncateBodyPreview } from '../../src/utils/truncateBodyPreview.js';

import { getUniqueString } from '@couimet/dynamic-testing';
import { describe, expect, it } from '@jest/globals';

const MAX_LENGTH = 10;

describe('truncateBodyPreview', () => {
  it('returns undefined for null input', () => {
    expect(truncateBodyPreview(null, MAX_LENGTH)).toBeUndefined();
  });

  it('returns undefined for undefined input', () => {
    expect(truncateBodyPreview(undefined, MAX_LENGTH)).toBeUndefined();
  });

  it('returns empty string for empty string input', () => {
    expect(truncateBodyPreview('', MAX_LENGTH)).toBe('');
  });

  it('returns full string when shorter than maxLength', () => {
    const body = getUniqueString({ maxLength: 5 });
    expect(truncateBodyPreview(body, MAX_LENGTH)).toBe(body);
  });

  it('truncates string when longer than maxLength', () => {
    const body = getUniqueString({ maxLength: MAX_LENGTH + 5 });
    expect(truncateBodyPreview(body, MAX_LENGTH)).toBe(body.slice(0, MAX_LENGTH));
  });

  it('returns full string when exactly maxLength', () => {
    const body = getUniqueString({ maxLength: MAX_LENGTH });
    expect(truncateBodyPreview(body, MAX_LENGTH)).toBe(body);
  });
});
