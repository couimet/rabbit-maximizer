const JITTER_RATIO = 0.15;
const RANDOM_RANGE_SIZE = 2;
const RANDOM_RANGE_SHIFT = 1;
const NEUTRAL_MULTIPLIER = 1;

export const getJitter = (base: number): number => {
  const centeredRandom = Math.random() * RANDOM_RANGE_SIZE - RANDOM_RANGE_SHIFT;
  const factor = NEUTRAL_MULTIPLIER + centeredRandom * JITTER_RATIO;
  return Math.round(base * factor);
};
