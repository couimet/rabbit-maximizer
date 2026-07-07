import type { components } from '../../src/api-types.js';

export type EventCounts = components['schemas']['EventCounts'];
export type QueueItem = components['schemas']['QueueItem'];
export type EventEntry = components['schemas']['EventEntry'];
export type SummaryResponse = components['schemas']['Summary'];
export type DashboardStateResponse = components['schemas']['DashboardState'];

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

const API_BASE = '/api';

const fetchJson = async <T>(url: string, init?: RequestInit): Promise<T> => {
  const res = await fetch(url, init);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`);
  }
  return res.json();
};

export const fetchSummary = (duration?: string): Promise<SummaryResponse> => {
  const params = duration ? `?duration=${duration}` : '';
  return fetchJson<SummaryResponse>(`${API_BASE}/summary${params}`);
};

export const fetchDashboardState = (duration?: string): Promise<DashboardStateResponse> => {
  const params = duration ? `?duration=${duration}` : '';
  return fetchJson<DashboardStateResponse>(`${API_BASE}/dashboard-state${params}`);
};

export const fetchQueue = (page: number, pageSize: number): Promise<PaginatedResponse<QueueItem>> =>
  fetchJson<PaginatedResponse<QueueItem>>(`${API_BASE}/queue?page=${page}&pageSize=${pageSize}`);

export const fetchEvents = (page: number, pageSize: number): Promise<PaginatedResponse<EventEntry>> =>
  fetchJson<PaginatedResponse<EventEntry>>(`${API_BASE}/events?page=${page}&pageSize=${pageSize}`);

export const fetchQueueOrder = (): Promise<{ data: QueueItem[] }> => fetchJson<{ data: QueueItem[] }>(`${API_BASE}/queue/order`);

export const moveQueueItems = (queueItemUuids: string[], direction: 'up' | 'down'): Promise<{ data: QueueItem[] }> =>
  fetchJson<{ data: QueueItem[] }>(`${API_BASE}/queue/order/move`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ queueItemUuids, direction }),
  });

export const retriggerNow = (uuid: string): Promise<{ ok: boolean; schedulerTickIntervalSec: number }> =>
  fetchJson<{ ok: boolean; schedulerTickIntervalSec: number }>(API_BASE + '/queue/' + uuid + '/retrigger-now', { method: 'POST' });
