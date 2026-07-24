import { createContext, type ReactNode, useCallback, useContext, useState } from 'react';

export interface ErrorEntry {
  id: string;
  message: string;
}

interface ErrorContextValue {
  errors: ErrorEntry[];
  reportError: (id: string, message: string) => void;
  dismissError: (id: string) => void;
}

const ErrorContext = createContext<ErrorContextValue | null>(null);

export const ErrorProvider = ({ children }: { children: ReactNode }) => {
  const [errors, setErrors] = useState<ErrorEntry[]>([]);

  const reportError = useCallback((id: string, message: string) => {
    setErrors((prev) => {
      const existing = prev.find((e) => e.id === id);
      if (existing && existing.message === message) return prev;
      const filtered = prev.filter((e) => e.id !== id);
      return [...filtered, { id, message }];
    });
  }, []);

  const dismissError = useCallback((id: string) => {
    setErrors((prev) => prev.filter((e) => e.id !== id));
  }, []);

  return <ErrorContext.Provider value={{ errors, reportError, dismissError }}>{children}</ErrorContext.Provider>;
};

export const useErrorContext = (): ErrorContextValue => {
  const ctx = useContext(ErrorContext);
  /* c8 ignore next 2 — unreachable: ErrorProvider always wraps the app */
  if (!ctx) throw new Error('useErrorContext must be used within ErrorProvider');
  return ctx;
};
