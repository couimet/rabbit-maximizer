/** @jest-environment jsdom */

import ReviewCountdown from '../../dashboard/src/components/ReviewCountdown.js';

import '@testing-library/jest-dom/jest-globals';
import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { act, cleanup, render } from '@testing-library/react';

afterEach(() => {
  cleanup();
  jest.useRealTimers();
});

describe('ReviewCountdown', () => {
  it('renders Available now when target is null', () => {
    const { queryByText } = render(<ReviewCountdown target={null} />);
    expect(queryByText('Available now')).toBeInTheDocument();
  });

  it('renders Available now when target is in the past', () => {
    const target = new Date(Date.now() - 60_000);
    const { queryByText } = render(<ReviewCountdown target={target} />);
    expect(queryByText('Available now')).toBeInTheDocument();
  });

  it('renders countdown when target is in the future', () => {
    const target = new Date(Date.now() + 2_000);
    const { queryByText } = render(<ReviewCountdown target={target} />);
    expect(queryByText('Next review available in')).toBeInTheDocument();
  });

  it('uses fake timers to verify countdown ticks each second', () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-01-01T00:00:00Z'));

    const target = new Date('2026-01-01T00:01:00Z');
    const { queryByText } = render(<ReviewCountdown target={target} />);

    expect(queryByText(/0h 01m 00s/)).toBeInTheDocument();

    act(() => {
      jest.advanceTimersByTime(1_000);
    });

    expect(queryByText(/0h 00m 59s/)).toBeInTheDocument();
  });

  it('cleans up interval on unmount', () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-01-01T00:00:00Z'));

    const clearIntervalSpy = jest.spyOn(globalThis, 'clearInterval');
    const target = new Date('2026-01-01T00:01:00Z');
    const { unmount } = render(<ReviewCountdown target={target} />);

    unmount();

    expect(clearIntervalSpy).toHaveBeenCalled();
  });
});
