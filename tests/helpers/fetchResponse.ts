export const fetchResponse = (port: number, path: string): Promise<Response> => {
  return fetch(`http://[::1]:${port}${path}`);
};
