export const getJson = async (port: number, path: string): Promise<unknown> => {
  const res = await fetch(`http://[::1]:${port}${path}`);
  return res.json();
};
