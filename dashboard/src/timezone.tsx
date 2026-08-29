import { isValidTimezone } from '../../src/utils/index.js';

import { createContext, type ReactNode, useCallback, useContext, useMemo, useState } from 'react';

interface TimezoneState {
  timezone: string;
  setTimezone: (tz: string) => void;
}

const STORAGE_KEY = 'rm-timezone';

const TimezoneContext = createContext<TimezoneState | null>(null);

export const TimezoneProvider = ({ children }: { children: ReactNode }) => {
  const [timezone, setTimezoneState] = useState(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored && isValidTimezone(stored) ? stored : 'UTC';
  });

  const setTimezone = useCallback((tz: string) => {
    setTimezoneState(tz);
    localStorage.setItem(STORAGE_KEY, tz);
  }, []);

  const value = useMemo(() => ({ timezone, setTimezone }), [timezone, setTimezone]);

  return <TimezoneContext.Provider value={value}>{children}</TimezoneContext.Provider>;
};

export const useTimezone = (): TimezoneState => {
  const ctx = useContext(TimezoneContext);
  if (!ctx) throw new Error('useTimezone must be used within TimezoneProvider');
  return ctx;
};

export const detectLocalTimezone = (): string => Intl.DateTimeFormat().resolvedOptions().timeZone;

export const getTimezoneLabel = (tz: string): string => {
  if (tz === 'UTC') return 'UTC';
  return `Local (${tz})`;
};

export const useTimezoneSuffix = (): string => {
  const { timezone } = useTimezone();
  return timezone === 'UTC' ? ' (UTC)' : '';
};
