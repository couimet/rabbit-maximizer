export const postJson = (port: number, path: string, body: unknown): Promise<Response> => {
  return fetch(`http://[::1]:${port}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
};
