export const filterActiveEventCounts = (counts: Record<string, number>): Record<string, number> => {
  const {
    bypassed: _bypassed,
    coderabbit_review_approved: _coderabbit_review_approved,
    coderabbit_review_changes_requested: _coderabbit_review_changes_requested,
    ...active
  } = counts;
  return active;
};
