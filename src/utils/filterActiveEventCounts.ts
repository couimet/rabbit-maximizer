export const filterActiveEventCounts = (counts: Record<string, number>): Record<string, number> => {
  const { bypassed: _bypassed, completed: _completed, ...active } = counts;
  return active;
};
