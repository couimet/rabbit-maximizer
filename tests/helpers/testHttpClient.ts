import type { Server } from 'http';

export const getJson = async (server: Server, path: string): Promise<unknown> => {
  const addr = server.address();
  if (!addr || typeof addr === 'string') throw new Error('Server not listening');
  const res = await fetch(`http://[::1]:${addr.port}${path}`);
  return res.json();
};

export const fetchResponse = async (server: Server, path: string): Promise<Response> => {
  const addr = server.address();
  if (!addr || typeof addr === 'string') throw new Error('Server not listening');
  return fetch(`http://[::1]:${addr.port}${path}`);
};
