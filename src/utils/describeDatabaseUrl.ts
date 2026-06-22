const describeDatabaseUrl = (raw: string) => {
  const url = new URL(raw);
  return `${url.protocol}//${url.host}${url.pathname}`;
};

export { describeDatabaseUrl };
