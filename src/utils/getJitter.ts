const JITTER_RATIO = 0.15;

/** Multiply a base value by a random factor within ±JITTER_RATIO (0.85–1.15). Returns a rounded integer. */
export const getJitter = (base: number): number => {
  const factor = 1 + (Math.random() * 2 - 1) * JITTER_RATIO;
  return Math.round(base * factor);
};
