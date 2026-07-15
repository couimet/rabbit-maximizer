import { MS_PER_SECOND } from '../../../src/utils/durations.js';
import { fetchConfig } from '../api.js';
import { diagLog } from '../utils/diagLog.js';

import { useEffect, useRef } from 'react';

interface UsePauseNotificationOptions {
  paused: boolean;
}

export const usePauseNotification = ({ paused }: UsePauseNotificationOptions): void => {
  const initialTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const repeatTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const notificationRef = useRef<Notification | null>(null);
  const mountedRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // fire-and-forget — errors are silently ignored
  useEffect(() => {
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {
        /* user dismissed or denied */
      });
    }
  }, []);

  useEffect(() => {
    const clearTimers = (reason: string) => {
      diagLog('pause-notif', 'clearing timers:', reason, { initialTimer: !!initialTimerRef.current, repeatTimer: !!repeatTimerRef.current });
      if (initialTimerRef.current !== null) {
        clearTimeout(initialTimerRef.current);
        initialTimerRef.current = null;
      }
      if (repeatTimerRef.current !== null) {
        clearInterval(repeatTimerRef.current);
        repeatTimerRef.current = null;
      }
      if (notificationRef.current !== null) {
        notificationRef.current.close();
        notificationRef.current = null;
      }
    };

    if (!paused) {
      clearTimers('paused is false');
      return;
    }

    diagLog('pause-notif', 'fetching config to schedule notifications');
    let cancelled = false;

    fetchConfig()
      .then((config) => {
        if (!mountedRef.current || cancelled || !paused) {
          diagLog('pause-notif', 'config fetch resolved but skipping:', { mounted: mountedRef.current, cancelled, paused });
          return;
        }

        const initialDelayMs = config.pauseNotificationInitialDelaySec * MS_PER_SECOND;
        const repeatIntervalMs = config.pauseNotificationRepeatIntervalSec * MS_PER_SECOND;

        diagLog(
          'pause-notif',
          'scheduling initial notification in',
          config.pauseNotificationInitialDelaySec,
          'sec, repeat every',
          config.pauseNotificationRepeatIntervalSec,
          'sec',
        );

        initialTimerRef.current = setTimeout(() => {
          /* c8 ignore next 4 — safety guard: cleanup clears this timeout before it fires */
          if (!mountedRef.current || !paused) {
            diagLog('pause-notif', 'initial timeout fired but skipping:', { mounted: mountedRef.current, paused });
            return;
          }

          let repeatCount = 0;

          const showNotification = () => {
            diagLog(
              'pause-notif',
              'showNotification called, repeatCount:',
              repeatCount,
              'permission:',
              typeof Notification !== 'undefined' ? Notification.permission : 'unsupported',
            );
            if (typeof Notification === 'undefined') return;
            if (Notification.permission !== 'granted') return;

            const notification = new Notification('Rabbit Maximizer is paused', {
              body: 'The maximizer has been paused. Reviews are not being requested. Resume to continue.',
              requireInteraction: true,
              tag: 'rabbit-maximizer-paused',
            });
            notification.onclick = () => {
              window.focus();
              notification.close();
            };
            notificationRef.current = notification;
            diagLog('pause-notif', 'notification shown');
          };

          diagLog('pause-notif', 'initial timeout fired, showing first notification');
          showNotification();

          diagLog('pause-notif', 'starting repeat interval every', repeatIntervalMs, 'ms');
          repeatTimerRef.current = setInterval(() => {
            /* c8 ignore next — safety guard: cleanup clears this interval before it fires after unmount */
            if (!mountedRef.current) return;
            repeatCount++;
            diagLog('pause-notif', 'repeat interval tick #', repeatCount);
            showNotification();
          }, repeatIntervalMs);
        }, initialDelayMs);
      })
      .catch(() => {
        diagLog('pause-notif', 'config fetch failed, skipping notifications');
      });

    return () => {
      cancelled = true;
      clearTimers('effect cleanup');
    };
  }, [paused]);
};
