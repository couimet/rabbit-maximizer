import type { Server } from 'http';

export const fetchResponse = (server: Server, path: string): Promise<Response> => {
  const addr = server.address();
  if (!addr || typeof addr === 'string') throw new Error('Server not listening');
  return fetch(`http://[::1]:${addr.port}${path}`);
};
