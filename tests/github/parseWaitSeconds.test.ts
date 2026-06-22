import { parseWaitSeconds } from '../../src/github/parseWaitSeconds.js';

import { describe, expect, it } from '@jest/globals';

describe('parseWaitSeconds', () => {
  it('extracts minutes and seconds from the standard CodeRabbit format', () => {
    const body = 'Please wait 11 minutes and 35 seconds before requesting another review.';
    expect(parseWaitSeconds(body)).toBe(695);
  });

  it('handles singular minute and second', () => {
    const body = 'Please wait 1 minute and 1 second before requesting another review.';
    expect(parseWaitSeconds(body)).toBe(61);
  });

  it('handles minutes only (no seconds clause)', () => {
    const body = 'Please wait 5 minutes before requesting another review.';
    expect(parseWaitSeconds(body)).toBe(300);
  });

  it('is case-insensitive', () => {
    const body = 'PLEASE WAIT 2 MINUTES AND 30 SECONDS BEFORE REQUESTING ANOTHER REVIEW.';
    expect(parseWaitSeconds(body)).toBe(150);
  });

  it('returns undefined when the body does not match the expected format', () => {
    expect(parseWaitSeconds('some random text')).toBeUndefined();
  });

  it('returns undefined for an empty string', () => {
    expect(parseWaitSeconds('')).toBeUndefined();
  });

  it('returns undefined when no numeric value is present', () => {
    expect(parseWaitSeconds('Please wait minutes and seconds before requesting another review.')).toBeUndefined();
  });
});
