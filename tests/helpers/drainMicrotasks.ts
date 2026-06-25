/**
 * Drains the microtask queue by awaiting `count` Promise.resolve() ticks.
 */
export const drainMicrotasks = async (count: number): Promise<void> => {
  for (let i = 0; i < count; i++) {
    await Promise.resolve();
  }
};
