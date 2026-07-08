import type { components } from '../../src/api-types.js';

import { buildQueryString } from './queryParams.js';

export type EventCounts = components['schemas']['EventCounts'];
export type QueueItem = components['schemas']['QueueItem'];
export type EventEntry = components['schemas']['EventEntry'];
export type SummaryResponse = components['schemas']['Summary'];
export type DashboardStateResponse = components['schemas']['DashboardState'];
export type PublicConfig = components['schemas']['PublicConfig'];

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
  const params = buildQueryString({ duration });
  return fetchJson<SummaryResponse>(`${API_BASE}/summary${params}`);
};

export const fetchConfig = (): Promise<PublicConfig> => fetchJson<PublicConfig>(`${API_BASE}/config`);

export const fetchDashboardState = (duration?: string): Promise<DashboardStateResponse> => {
  const params = buildQueryString({ duration });
  return fetchJson<DashboardStateResponse>(`${API_BASE}/dashboard-state${params}`);
};

export const fetchQueue = (page: number, pageSize: number): Promise<PaginatedResponse<QueueItem>> =>
  fetchJson<PaginatedResponse<QueueItem>>(`${API_BASE}/queue${buildQueryString({ page, pageSize })}`);

export const fetchTriggered = (since: Date, page: number, pageSize: number, includeCompleted: boolean): Promise<PaginatedResponse<QueueItem>> =>
  fetchJson<PaginatedResponse<QueueItem>>(`${API_BASE}/queue/triggered${buildQueryString({ since, page, pageSize, include_completed: includeCompleted })}`);

export const fetchEvents = (page: number, pageSize: number): Promise<PaginatedResponse<EventEntry>> =>
  fetchJson<PaginatedResponse<EventEntry>>(`${API_BASE}/events${buildQueryString({ page, pageSize })}`);

export const fetchQueueOrder = (): Promise<{ data: QueueItem[] }> => fetchJson<{ data: QueueItem[] }>(`${API_BASE}/queue/order`);

export const moveQueueItems = (queueItemUuids: string[], direction: 'up' | 'down'): Promise<{ data: QueueItem[] }> =>
  fetchJson<{ data: QueueItem[] }>(`${API_BASE}/queue/order/move`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ queueItemUuids, direction }),
  });

export const retriggerNow = (uuid: string): Promise<{ ok: boolean; schedulerTickIntervalSec: number }> =>
  fetchJson<{ ok: boolean; schedulerTickIntervalSec: number }>(API_BASE + '/queue/' + uuid + '/retrigger-now', { method: 'POST' });

export const markCompleted = (uuid: string): Promise<{ ok: boolean }> =>
  fetchJson<{ ok: boolean }>(`${API_BASE}/queue/${uuid}/mark-completed`, { method: 'POST' });

export const setPaused = (paused: boolean): Promise<{ paused: boolean }> =>
  fetchJson<{ paused: boolean }>(`${API_BASE}/pause`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ paused }),
  });
