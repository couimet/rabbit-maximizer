/** @jest-environment jsdom */

import { detectLocalTimezone, getTimezoneLabel, TimezoneProvider, useTimezone, useTimezoneSuffix } from '../../dashboard/src/timezone.js';

import '@testing-library/jest-dom/jest-globals';
import { beforeEach, describe, expect, it } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react';

describe('TimezoneProvider', () => {
  beforeEach(() => {
    localStorage.clear();
  });

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

  it('validates stored localStorage value and falls back to UTC for invalid timezones', () => {
    localStorage.setItem('rm-timezone', 'Not/AZone');
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

  it('restores valid timezone from localStorage', () => {
    localStorage.setItem('rm-timezone', 'America/New_York');
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
    expect(captured).toBe('America/New_York');
  });

  it('setTimezone persists to localStorage and updates context value', () => {
    let captured: string | undefined;
    const Reader = () => {
      const { timezone, setTimezone } = useTimezone();
      captured = timezone;
      return <button onClick={() => setTimezone('America/Chicago')}>Set</button>;
    };
    render(
      <TimezoneProvider>
        <Reader />
      </TimezoneProvider>,
    );
    expect(captured).toBe('UTC');
    fireEvent.click(screen.getByText('Set'));
    expect(captured).toBe('America/Chicago');
    expect(localStorage.getItem('rm-timezone')).toBe('America/Chicago');
  });
});

describe('useTimezoneSuffix', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns " (UTC)" when timezone is UTC', () => {
    let captured: string | undefined;
    const Reader = () => {
      captured = useTimezoneSuffix();
      return null;
    };
    render(
      <TimezoneProvider>
        <Reader />
      </TimezoneProvider>,
    );
    expect(captured).toBe(' (UTC)');
  });

  it('returns empty string for non-UTC timezone', () => {
    localStorage.setItem('rm-timezone', 'America/New_York');
    let captured: string | undefined;
    const Reader = () => {
      captured = useTimezoneSuffix();
      return null;
    };
    render(
      <TimezoneProvider>
        <Reader />
      </TimezoneProvider>,
    );
    expect(captured).toBe('');
  });
});

describe('detectLocalTimezone', () => {
  it('returns a non-empty string', () => {
    const tz = detectLocalTimezone();
    expect(typeof tz).toBe('string');
    expect(tz.length).toBeGreaterThan(0);
  });
});

describe('getTimezoneLabel', () => {
  it('returns "UTC" for UTC', () => {
    expect(getTimezoneLabel('UTC')).toBe('UTC');
  });

  it('returns "Local (...)" format for other timezones', () => {
    expect(getTimezoneLabel('America/New_York')).toBe('Local (America/New_York)');
  });
});
