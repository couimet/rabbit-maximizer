export const formatDate = (iso: string): string => new Date(iso).toISOString().replace('T', ' ').slice(0, 19);
