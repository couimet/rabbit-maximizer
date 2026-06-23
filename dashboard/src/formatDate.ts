const TIMESTAMP_LENGTH = 19;

export const formatDate = (iso: string): string => {
  const date = new Date(iso);
  if (isNaN(date.getTime())) return 'Invalid date';
  return date.toISOString().replace('T', ' ').slice(0, TIMESTAMP_LENGTH);
};
