const STORAGE_KEY = 'rabbitMaximizer-diagnosis';

const isEnabled = (): boolean => {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'true';
    /* c8 ignore next 3 — unreachable in Node: localStorage is a browser API */
  } catch {
    return false;
  }
};

export const diagLog = (tag: string, ...args: unknown[]): void => {
  /* c8 ignore next 3 — unreachable in Node: diagLog is a browser-only utility */
  if (!isEnabled()) return;
  console.log(`[rabbitMaximizer-${tag}]`, ...args);
};

/* c8 ignore start — unreachable in Node: window is a browser API */
if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'RABBIT_MAXIMIZER_DIAGNOSIS_LOGGING', {
    get: () => isEnabled(),
    set: (val: boolean) => {
      try {
        if (val) {
          localStorage.setItem(STORAGE_KEY, 'true');
        } else {
          localStorage.removeItem(STORAGE_KEY);
        }
      } catch {
        // localStorage unavailable (private browsing, storage full)
      }
    },
    configurable: true,
  });
}
/* c8 ignore stop */
