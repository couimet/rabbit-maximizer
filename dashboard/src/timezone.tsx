import { createContext, type ReactNode, useCallback, useContext, useState } from 'react';

interface TimezoneState {
  timezone: string;
  setTimezone: (tz: string) => void;
}

const STORAGE_KEY = 'rm-timezone';

const TimezoneContext = createContext<TimezoneState | null>(null);

export const TimezoneProvider = ({ children }: { children: ReactNode }) => {
  const [timezone, setTimezoneState] = useState(() => localStorage.getItem(STORAGE_KEY) ?? 'UTC');

  const setTimezone = useCallback((tz: string) => {
    setTimezoneState(tz);
    localStorage.setItem(STORAGE_KEY, tz);
  }, []);

  return <TimezoneContext.Provider value={{ timezone, setTimezone }}>{children}</TimezoneContext.Provider>;
};

export const useTimezone = (): TimezoneState => {
  const ctx = useContext(TimezoneContext);
  if (!ctx) throw new Error('useTimezone must be used within TimezoneProvider');
  return ctx;
};

export const useTimezoneSuffix = (): string => {
  const { timezone } = useTimezone();
  return timezone === 'UTC' ? ' (UTC)' : '';
};

export const detectLocalTimezone = (): string => Intl.DateTimeFormat().resolvedOptions().timeZone;

export const getTimezoneLabel = (tz: string): string => {
  if (tz === 'UTC') return 'UTC';
  return `Local (${tz})`;
};
