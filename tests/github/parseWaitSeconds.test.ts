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

  it('extracts minutes from the Next review available in format', () => {
    expect(parseWaitSeconds('Next review available in: 7 minutes')).toBe(420);
  });

  it('handles singular minute in the Next review available in format', () => {
    expect(parseWaitSeconds('Next review available in: 1 minute')).toBe(60);
  });

  it('returns undefined for Next review available in text without a number', () => {
    expect(parseWaitSeconds('Next review available in: minutes')).toBeUndefined();
  });

  it('extracts minutes when the Next review available in text uses bold markers', () => {
    expect(parseWaitSeconds('**Next review available in:** **12 minutes**')).toBe(720);
  });

  it('extracts minutes when the primary format uses bold markers', () => {
    expect(parseWaitSeconds('**Please wait** 3 **minutes and** 45 **seconds before requesting another review.**')).toBe(225);
  });
});
