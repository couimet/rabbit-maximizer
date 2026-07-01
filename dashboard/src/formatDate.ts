const TIMESTAMP_LENGTH = 19;

export const formatDate = (iso: string, timezone?: string): string => {
  const date = new Date(iso);
  if (isNaN(date.getTime())) return 'Invalid date';

  if (!timezone || timezone === 'UTC') {
    return date.toISOString().replace('T', ' ').slice(0, TIMESTAMP_LENGTH);
  }

  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(date);

  const map = new Map(parts.map((p) => [p.type, p.value]));
  return `${map.get('year')}-${map.get('month')}-${map.get('day')} ${map.get('hour')}:${map.get('minute')}:${map.get('second')}`;
};
