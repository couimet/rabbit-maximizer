/** @jest-environment jsdom */

import { usePauseNotification } from '../../dashboard/src/components/usePauseNotification.js';
import { MS_PER_SECOND } from '../../src/utils/durations.js';

import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, renderHook } from '@testing-library/react';

const MOCK_CONFIG = {
  pauseNotificationInitialDelaySec: 1800,
  pauseNotificationRepeatIntervalSec: 900,
};

describe('usePauseNotification', () => {
  beforeEach(() => {
    jest.useFakeTimers();

    globalThis.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(MOCK_CONFIG),
      } as Response),
    ) as unknown as typeof fetch;

    const notificationMock = Object.assign(
      jest.fn(() => ({ close: jest.fn() })),
      {
        requestPermission: jest.fn(() => Promise.resolve('granted' as const)),
        permission: 'default',
      },
    );

    Object.defineProperty(globalThis, 'Notification', {
      writable: true,
      configurable: true,
      value: notificationMock,
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('requests notification permission on mount when permission is default', () => {
    renderHook(() => usePauseNotification({ paused: true }));

    expect(globalThis.Notification.requestPermission).toHaveBeenCalled();
  });

  it('does not request permission when already granted', () => {
    (globalThis.Notification as unknown as { permission: string }).permission = 'granted';

    renderHook(() => usePauseNotification({ paused: true }));

    expect(globalThis.Notification.requestPermission).not.toHaveBeenCalled();
  });

  it('does not request permission when already denied', () => {
    (globalThis.Notification as unknown as { permission: string }).permission = 'denied';

    renderHook(() => usePauseNotification({ paused: true }));

    expect(globalThis.Notification.requestPermission).not.toHaveBeenCalled();
  });

  it('fires notification after initial delay when paused', async () => {
    (globalThis.Notification as unknown as { permission: string }).permission = 'granted';

    renderHook(() => usePauseNotification({ paused: true }));

    // Flush microtasks so the .then() runs and schedules the setTimeout
    await act(async () => {
      await jest.advanceTimersByTimeAsync(0);
    });

    // Advance time past the initial delay
    await act(async () => {
      await jest.advanceTimersByTimeAsync(MOCK_CONFIG.pauseNotificationInitialDelaySec * MS_PER_SECOND);
    });

    expect(globalThis.Notification).toHaveBeenCalledTimes(1);
    expect(globalThis.Notification).toHaveBeenCalledWith('Rabbit Maximizer is paused', {
      body: 'The maximizer has been paused. Reviews are not being requested. Resume to continue.',
      requireInteraction: true,
      tag: 'rabbit-maximizer-paused',
    });
  });

  it('notification onclick focuses the window and closes the notification', async () => {
    (globalThis.Notification as unknown as { permission: string }).permission = 'granted';
    jest.spyOn(window, 'focus').mockImplementation(() => {});
    const closeMock = jest.fn();
    (globalThis.Notification as unknown as jest.Mock).mockImplementation(() => ({
      close: closeMock,
    }));

    renderHook(() => usePauseNotification({ paused: true }));

    await act(async () => {
      await jest.advanceTimersByTimeAsync(0);
    });
    await act(async () => {
      await jest.advanceTimersByTimeAsync(MOCK_CONFIG.pauseNotificationInitialDelaySec * MS_PER_SECOND);
    });

    const notificationInstance = ((globalThis.Notification as unknown as jest.Mock).mock.results[0] as { value: { onclick: () => void; close: () => void } })
      .value;
    notificationInstance.onclick();

    expect(window.focus).toHaveBeenCalled();
    expect(closeMock).toHaveBeenCalled();
  });

  it('fires repeat notification at interval cadence', async () => {
    (globalThis.Notification as unknown as { permission: string }).permission = 'granted';

    renderHook(() => usePauseNotification({ paused: true }));

    await act(async () => {
      await jest.advanceTimersByTimeAsync(0);
    });

    await act(async () => {
      await jest.advanceTimersByTimeAsync(MOCK_CONFIG.pauseNotificationInitialDelaySec * MS_PER_SECOND);
    });

    expect(globalThis.Notification).toHaveBeenCalledTimes(1);

    // Advance one repeat interval
    await act(async () => {
      await jest.advanceTimersByTimeAsync(MOCK_CONFIG.pauseNotificationRepeatIntervalSec * MS_PER_SECOND);
    });

    expect(globalThis.Notification).toHaveBeenCalledTimes(2);

    // Advance another repeat interval
    await act(async () => {
      await jest.advanceTimersByTimeAsync(MOCK_CONFIG.pauseNotificationRepeatIntervalSec * MS_PER_SECOND);
    });

    expect(globalThis.Notification).toHaveBeenCalledTimes(3);
  });

  it('clears timers and closes notification when paused becomes false', async () => {
    (globalThis.Notification as unknown as { permission: string }).permission = 'granted';
    const closeMock = jest.fn();
    (globalThis.Notification as unknown as jest.Mock).mockImplementation(() => ({
      close: closeMock,
    }));

    const { rerender } = renderHook(({ paused }: { paused: boolean }) => usePauseNotification({ paused }), { initialProps: { paused: true } });

    await act(async () => {
      await jest.advanceTimersByTimeAsync(0);
    });
    await act(async () => {
      await jest.advanceTimersByTimeAsync(MOCK_CONFIG.pauseNotificationInitialDelaySec * MS_PER_SECOND);
    });

    expect(globalThis.Notification).toHaveBeenCalledTimes(1);
    expect(closeMock).not.toHaveBeenCalled();

    // Switch to unpaused — closes notification and clears timers
    rerender({ paused: false });

    expect(closeMock).toHaveBeenCalledTimes(1);

    // Advance past the repeat interval — no more notifications
    await act(async () => {
      await jest.advanceTimersByTimeAsync(MOCK_CONFIG.pauseNotificationRepeatIntervalSec * MS_PER_SECOND * 2);
    });

    expect(globalThis.Notification).toHaveBeenCalledTimes(1);
  });

  it('does nothing when Notification API is undefined', async () => {
    delete (globalThis as Record<string, unknown>).Notification;

    renderHook(() => usePauseNotification({ paused: true }));

    await act(async () => {
      await jest.advanceTimersByTimeAsync(0);
    });
    await act(async () => {
      await jest.advanceTimersByTimeAsync(MOCK_CONFIG.pauseNotificationInitialDelaySec * MS_PER_SECOND);
    });

    // No crash — verify fetch was called
    expect(globalThis.fetch).toHaveBeenCalledWith('/api/config', undefined);
  });

  it('does not fire notification when permission is denied', async () => {
    (globalThis.Notification as unknown as { permission: string }).permission = 'denied';

    renderHook(() => usePauseNotification({ paused: true }));

    await act(async () => {
      await jest.advanceTimersByTimeAsync(0);
    });
    await act(async () => {
      await jest.advanceTimersByTimeAsync(MOCK_CONFIG.pauseNotificationInitialDelaySec * MS_PER_SECOND);
    });

    expect(globalThis.Notification).not.toHaveBeenCalled();
  });

  it('handles requestPermission rejection gracefully', async () => {
    (globalThis.Notification as unknown as { requestPermission: (...args: never[]) => Promise<never> }).requestPermission = () =>
      Promise.reject(new Error('Permission dismissed'));

    renderHook(() => usePauseNotification({ paused: true }));

    // Should not throw — the .catch() handles it
    await act(async () => {
      await Promise.resolve();
    });
  });

  it('skips notifications when fetchConfig fails', async () => {
    (globalThis.Notification as unknown as { permission: string }).permission = 'granted';
    globalThis.fetch = jest.fn(() => Promise.reject(new Error('Network error'))) as unknown as typeof fetch;

    renderHook(() => usePauseNotification({ paused: true }));

    await act(async () => {
      await jest.advanceTimersByTimeAsync(0);
    });

    // Advance past the initial delay — no notification should fire
    await act(async () => {
      await jest.advanceTimersByTimeAsync(MOCK_CONFIG.pauseNotificationInitialDelaySec * MS_PER_SECOND);
    });

    expect(globalThis.Notification).not.toHaveBeenCalled();
  });

  it('does nothing when paused is false at initial render', () => {
    renderHook(() => usePauseNotification({ paused: false }));

    // fetchConfig should not be called when paused is false
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('cancels pending notification setup when paused changes before config fetch resolves', async () => {
    (globalThis.Notification as unknown as { permission: string }).permission = 'granted';
    let resolveFetch!: (v: Response) => void;
    const pendingFetch = new Promise<Response>((resolve) => {
      resolveFetch = resolve;
    });
    globalThis.fetch = jest.fn(() => pendingFetch) as unknown as typeof fetch;

    const { rerender } = renderHook(({ paused }: { paused: boolean }) => usePauseNotification({ paused }), { initialProps: { paused: true } });

    // Change paused while the fetch is pending — cleanup sets cancelled=true
    rerender({ paused: false });

    // Resolve the fetch — .then() should see cancelled=true and return early
    resolveFetch!({
      ok: true,
      status: 200,
      json: () => Promise.resolve(MOCK_CONFIG),
    } as Response);

    await act(async () => {
      await jest.advanceTimersByTimeAsync(0);
    });

    // Advance past the initial delay — no notification should have been scheduled
    await act(async () => {
      await jest.advanceTimersByTimeAsync(MOCK_CONFIG.pauseNotificationInitialDelaySec * MS_PER_SECOND);
    });

    expect(globalThis.Notification).not.toHaveBeenCalled();
  });

  it('cancels pending notification when component unmounts while fetch is in-flight', async () => {
    (globalThis.Notification as unknown as { permission: string }).permission = 'granted';
    let resolveFetch!: (v: Response) => void;
    const pendingFetch = new Promise<Response>((resolve) => {
      resolveFetch = resolve;
    });
    globalThis.fetch = jest.fn(() => pendingFetch) as unknown as typeof fetch;

    const { unmount } = renderHook(() => usePauseNotification({ paused: true }));

    // Unmount while fetch is in-flight — cleanup sets mountedRef to false
    unmount();

    // Resolve the fetch — .then() should see mountedRef.current=false
    resolveFetch!({
      ok: true,
      status: 200,
      json: () => Promise.resolve(MOCK_CONFIG),
    } as Response);

    // Flush microtasks — .then() callback fires but returns early
    await act(async () => {
      await jest.advanceTimersByTimeAsync(0);
    });

    expect(globalThis.Notification).not.toHaveBeenCalled();
  });
});
