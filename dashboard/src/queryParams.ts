type ParamValue = string | number | boolean | Date;

export const buildQueryString = (params: Record<string, ParamValue | undefined>): string => {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) continue;
    const serialized = value instanceof Date ? value.toISOString() : String(value);
    parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(serialized)}`);
  }
  return parts.length > 0 ? `?${parts.join('&')}` : '';
};
