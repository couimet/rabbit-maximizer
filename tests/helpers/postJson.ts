import type { Server } from 'http';

export const postJson = (server: Server, path: string, body: unknown): Promise<Response> => {
  const addr = server.address();
  if (!addr || typeof addr === 'string') throw new Error('Server not listening');
  return fetch(`http://[::1]:${addr.port}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
};
