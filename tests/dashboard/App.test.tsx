/** @jest-environment jsdom */

import App from '../../dashboard/src/App.js';

import '@testing-library/jest-dom/jest-globals';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

const emptyDashboardState = {
  nextReviewAvailableAt: null,
  pendingItems: [],
  eventCounts: { detected: 0, enqueued: 0, retriggered: 0, failed: 0 },
};
const emptyEvents = { data: [], total: 0, page: 1, pageSize: 50 };
const emptyQueueOrder = { data: [] };

describe('App', () => {
  beforeEach(() => {
    localStorage.clear();
    const responses: Record<string, unknown> = {
      '/api/dashboard-state?duration=24h': emptyDashboardState,
      '/api/events?page=1&pageSize=50': emptyEvents,
      '/api/queue/order': emptyQueueOrder,
      '/api/config': { pauseNotificationInitialDelayMinutes: 30, pauseNotificationRepeatIntervalMinutes: 15 },
    };
    globalThis.fetch = jest.fn((url: string) =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(responses[url] ?? {}),
      } as Response),
    ) as unknown as typeof fetch;

    Object.defineProperty(globalThis, 'Notification', {
      writable: true,
      configurable: true,
      value: Object.assign(
        jest.fn(() => ({ close: jest.fn() })),
        {
          requestPermission: jest.fn(() => Promise.resolve('denied' as const)),
          permission: 'default',
        },
      ),
    });
  });

  it('renders the logo and title', async () => {
    render(<App />);
    expect(screen.getByAltText('Rabbit Maximizer')).toBeInTheDocument();
    expect(screen.getByText('Rabbit Maximizer')).toBeInTheDocument();
    await screen.findByText('No pending or retriggered items.');
  });

  it('renders two tab buttons', async () => {
    render(<App />);
    expect(screen.getByText('Summary')).toBeInTheDocument();
    expect(screen.getByText('Events')).toBeInTheDocument();
    await screen.findByText('No pending or retriggered items.');
  });

  it('renders the footer with GitHub link', async () => {
    render(<App />);
    const link = screen.getByText('github.com/couimet/rabbit-maximizer');
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', 'https://github.com/couimet/rabbit-maximizer');
    await screen.findByText('No pending or retriggered items.');
  });

  it('shows Summary tab content by default', async () => {
    render(<App />);
    await waitFor(() => expect(screen.getByText('No pending or retriggered items.')).toBeInTheDocument());
  });

  it('switches to Events tab and shows empty state', async () => {
    render(<App />);
    fireEvent.click(screen.getByText('Events'));
    await waitFor(() => expect(screen.getByText('No events.')).toBeInTheDocument());
  });

  it('switches back to Summary after visiting another tab', async () => {
    render(<App />);
    fireEvent.click(screen.getByText('Events'));
    await waitFor(() => expect(screen.getByText('No events.')).toBeInTheDocument());

    fireEvent.click(screen.getByText('Summary'));
    await waitFor(() => expect(screen.getByText('No pending or retriggered items.')).toBeInTheDocument());
  });

  describe('timezone selector', () => {
    it('renders timezone selector with UTC option', async () => {
      render(<App />);
      expect(screen.getByText('Timezone:')).toBeInTheDocument();
      expect(screen.getByRole('combobox', { name: 'Timezone:' })).toBeInTheDocument();
      expect(screen.getByText('UTC')).toBeInTheDocument();
      await screen.findByText('No pending or retriggered items.');
    });

    it('shows Local option when browser timezone differs from UTC', async () => {
      const localTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      render(<App />);
      if (localTz !== 'UTC') {
        expect(screen.getByText(/^Local \(/)).toBeInTheDocument();
      }
      await screen.findByText('No pending or retriggered items.');
    });

    it('shows Local option when detectLocalTimezone returns non-UTC', async () => {
      jest.spyOn(Intl, 'DateTimeFormat').mockReturnValue({
        resolvedOptions: () => ({ timeZone: 'America/New_York' }),
      } as Intl.DateTimeFormat);
      render(<App />);
      expect(screen.getByText('Local (America/New_York)')).toBeInTheDocument();
      await screen.findByText('No pending or retriggered items.');
    });

    it('persists selection to localStorage', async () => {
      render(<App />);
      const select = screen.getByRole('combobox', { name: 'Timezone:' }) as HTMLSelectElement;
      const options = Array.from(select.options).map((opt) => opt.value);
      const newValue = options.find((opt) => opt !== select.value) ?? options[0];
      fireEvent.change(select, { target: { value: newValue } });
      expect(localStorage.getItem('rm-timezone')).toBe(newValue);
      await screen.findByText('No pending or retriggered items.');
    });
  });
});
