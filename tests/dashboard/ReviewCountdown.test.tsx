/** @jest-environment jsdom */

import { ReviewCountdown } from '../../dashboard/src/index.js';

import '@testing-library/jest-dom/jest-globals';
import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { act, cleanup, fireEvent, render } from '@testing-library/react';

const DEFAULT_PROPS = { onTogglePaused: jest.fn(), toggling: false, schedulerStale: false, lastSchedulerTickAt: null };

afterEach(() => {
  cleanup();
});

describe('ReviewCountdown', () => {
  it('renders Available now when target is null', () => {
    const { queryByText } = render(<ReviewCountdown target={null} paused={false} {...DEFAULT_PROPS} />);
    expect(queryByText('Available now')).toBeInTheDocument();
  });

  it('renders Available now when target is in the past', () => {
    const target = new Date(Date.now() - 60_000);
    const { queryByText } = render(<ReviewCountdown target={target} paused={false} {...DEFAULT_PROPS} />);
    expect(queryByText('Available now')).toBeInTheDocument();
  });

  it('renders countdown when target is in the future', () => {
    const target = new Date(Date.now() + 2_000);
    const { queryByText } = render(<ReviewCountdown target={target} paused={false} {...DEFAULT_PROPS} />);
    expect(queryByText('Next review')).toBeInTheDocument();
  });

  it('uses fake timers to verify countdown ticks each second', () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-01-01T00:00:00Z'));

    const target = new Date('2026-01-01T00:01:00Z');
    const { queryByText } = render(<ReviewCountdown target={target} paused={false} {...DEFAULT_PROPS} />);

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
    const { unmount } = render(<ReviewCountdown target={target} paused={false} {...DEFAULT_PROPS} />);

    unmount();

    expect(clearIntervalSpy).toHaveBeenCalled();
  });

  describe('paused', () => {
    it('shows Paused label and Resume button when paused', () => {
      const { queryByText } = render(<ReviewCountdown target={null} paused={true} {...DEFAULT_PROPS} />);
      expect(queryByText('Paused')).toBeInTheDocument();
      expect(queryByText('Resume')).toBeInTheDocument();
    });

    it('still shows countdown when paused with a future target', () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2026-01-01T00:00:00Z'));

      const target = new Date('2026-01-01T00:02:00Z');
      const { queryByText } = render(<ReviewCountdown target={target} paused={true} {...DEFAULT_PROPS} />);
      expect(queryByText('Paused')).toBeInTheDocument();
      expect(queryByText(/0h 02m 00s/)).toBeInTheDocument();
    });

    it('shows Pause button when not paused', () => {
      const { queryByText } = render(<ReviewCountdown target={null} paused={false} {...DEFAULT_PROPS} />);
      expect(queryByText('Pause')).toBeInTheDocument();
    });

    it('calls onTogglePaused when toggle button is clicked', () => {
      const onTogglePaused = jest.fn();
      const { getByText } = render(<ReviewCountdown {...DEFAULT_PROPS} target={null} paused={false} onTogglePaused={onTogglePaused} toggling={false} />);

      fireEvent.click(getByText('Pause'));

      expect(onTogglePaused).toHaveBeenCalled();
    });

    it('disables toggle button when toggling', () => {
      const { getByLabelText } = render(<ReviewCountdown target={null} paused={false} {...DEFAULT_PROPS} toggling={true} />);

      expect(getByLabelText('Pause scheduler')).toBeDisabled();
    });
  });

  describe('stale scheduler', () => {
    it('shows Status unknown label when scheduler is stale', () => {
      const { queryByText } = render(<ReviewCountdown target={null} paused={false} {...DEFAULT_PROPS} schedulerStale={true} lastSchedulerTickAt={null} />);
      expect(queryByText('Status unknown')).toBeInTheDocument();
    });

    it('shows No heartbeat for X when scheduler is stale with a tick timestamp', () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2026-01-01T00:05:00Z'));

      const { queryByText } = render(
        <ReviewCountdown target={null} paused={false} {...DEFAULT_PROPS} schedulerStale={true} lastSchedulerTickAt="2026-01-01T00:00:00Z" />,
      );

      expect(queryByText(/No heartbeat for 5 minutes/)).toBeInTheDocument();
    });

    it('shows No heartbeat yet when scheduler is stale with null tick', () => {
      const { queryByText } = render(<ReviewCountdown target={null} paused={false} {...DEFAULT_PROPS} schedulerStale={true} lastSchedulerTickAt={null} />);
      expect(queryByText('No heartbeat yet')).toBeInTheDocument();
    });

    it('disables toggle button when scheduler is stale', () => {
      const { getByLabelText } = render(<ReviewCountdown target={null} paused={false} {...DEFAULT_PROPS} schedulerStale={true} lastSchedulerTickAt={null} />);
      expect(getByLabelText('Pause scheduler')).toBeDisabled();
    });

    it('disables toggle button when both stale and toggling', () => {
      const { getByLabelText } = render(
        <ReviewCountdown target={null} paused={false} {...DEFAULT_PROPS} schedulerStale={true} lastSchedulerTickAt={null} toggling={true} />,
      );
      expect(getByLabelText('Pause scheduler')).toBeDisabled();
    });
  });
});
