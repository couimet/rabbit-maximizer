/** @jest-environment jsdom */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import App from '../../dashboard/src/App.js';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

const emptySummary = {
  queueCounts: { pending: 0, posted: 0, completed: 0, failed: 0 },
  eventCounts24h: { detected: 0, enqueued: 0, posted: 0, rejected: 0, completed: 0, failed: 0 },
  oldestPending: null,
};
const emptyQueue = { data: [], total: 0, page: 1, pageSize: 20 };
const emptyEvents = { data: [], total: 0, page: 1, pageSize: 20 };

describe('App', () => {
  beforeEach(() => {
    const responses: Record<string, unknown> = {
      '/api/summary': emptySummary,
      '/api/queue?page=1&pageSize=20': emptyQueue,
      '/api/events?page=1&pageSize=20': emptyEvents,
    };
    globalThis.fetch = jest.fn((url: string) =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(responses[url] ?? {}),
      } as Response),
    ) as jest.Mock;
  });

  afterEach(() => {
    (globalThis.fetch as jest.Mock).mockRestore?.();
  });

  it('renders the logo and title', async () => {
    render(<App />);
    expect(screen.getByAltText('Rabbit Maximizer')).toBeInTheDocument();
    expect(screen.getByText('Rabbit Maximizer')).toBeInTheDocument();
    await screen.findByText('No pending items.');
  });

  it('renders all three tab buttons', async () => {
    render(<App />);
    expect(screen.getByText('Summary')).toBeInTheDocument();
    expect(screen.getByText('Queue')).toBeInTheDocument();
    expect(screen.getByText('Events')).toBeInTheDocument();
    await screen.findByText('No pending items.');
  });

  it('renders the footer with GitHub link', async () => {
    render(<App />);
    const link = screen.getByText('github.com/couimet/rabbit-maximizer');
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', 'https://github.com/couimet/rabbit-maximizer');
    await screen.findByText('No pending items.');
  });

  it('shows Summary tab content by default', async () => {
    render(<App />);
    await waitFor(() => expect(screen.getByText('No pending items.')).toBeInTheDocument());
  });

  it('switches to Queue tab and shows empty state', async () => {
    render(<App />);
    fireEvent.click(screen.getByText('Queue'));
    await waitFor(() => expect(screen.getByText('No queue items.')).toBeInTheDocument());
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
    await waitFor(() => expect(screen.getByText('No pending items.')).toBeInTheDocument());
  });
});
