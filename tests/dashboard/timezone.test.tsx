/** @jest-environment jsdom */

import { TimezoneProvider, useTimezone } from '../../dashboard/src/timezone.js';

import '@testing-library/jest-dom/jest-globals';
import { describe, expect, it } from '@jest/globals';
import { render } from '@testing-library/react';

describe('TimezoneProvider', () => {
  it('throws when useTimezone is called outside TimezoneProvider', () => {
    const Bad = () => {
      useTimezone();
      return null;
    };
    expect(() => render(<Bad />)).toThrow('useTimezone must be used within TimezoneProvider');
  });

  it('provides default UTC timezone when localStorage is empty', () => {
    let captured: string | undefined;
    const Reader = () => {
      const { timezone } = useTimezone();
      captured = timezone;
      return null;
    };
    render(
      <TimezoneProvider>
        <Reader />
      </TimezoneProvider>,
    );
    expect(captured).toBe('UTC');
  });
});
