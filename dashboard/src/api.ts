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
  if (res.status === 204) return undefined as T;
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

export const fetchTriggered = (since: Date, page: number, pageSize: number, includeReviewed: boolean): Promise<PaginatedResponse<QueueItem>> =>
  fetchJson<PaginatedResponse<QueueItem>>(`${API_BASE}/queue/triggered${buildQueryString({ since, page, pageSize, include_reviewed: includeReviewed })}`);

export const fetchEvents = (page: number, pageSize: number): Promise<PaginatedResponse<EventEntry>> =>
  fetchJson<PaginatedResponse<EventEntry>>(`${API_BASE}/events${buildQueryString({ page, pageSize })}`);

export const fetchQueueOrder = (): Promise<{ data: QueueItem[] }> => fetchJson<{ data: QueueItem[] }>(`${API_BASE}/queue/order`);

export const moveQueueItems = (queueItemUuids: string[], direction: 'up' | 'down'): Promise<{ data: QueueItem[] }> =>
  fetchJson<{ data: QueueItem[] }>(`${API_BASE}/queue/order/move`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ queueItemUuids, direction }),
  });

export const moveToTop = (queueItemUuid: string): Promise<void> =>
  fetchJson<void>(`${API_BASE}/queue/order/move-to-top`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ queueItemUuid }),
  });

export const retriggerNow = (uuid: string, overridePause?: boolean): Promise<void> => {
  const query = overridePause ? '?overridePause=true' : '';
  return fetchJson<void>(`${API_BASE}/queue/${uuid}/retrigger-now${query}`, { method: 'POST' });
};

export const markReviewed = (uuid: string): Promise<{ ok: boolean }> =>
  fetchJson<{ ok: boolean }>(`${API_BASE}/queue/${uuid}/mark-reviewed`, { method: 'POST' });

export const setPaused = (paused: boolean): Promise<{ paused: boolean }> =>
  fetchJson<{ paused: boolean }>(`${API_BASE}/pause`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ paused }),
  });
