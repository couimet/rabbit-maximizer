import { config } from '../config.js';
import type { EventRepository } from '../db/eventRepository.js';
import type { PullRequestRepository } from '../db/pullRequestRepository.js';
import type { QueueOrderRepository } from '../db/queueOrderRepository.js';
import type { SystemStateRepository } from '../db/systemStateRepository.js';
import { MS_PER_SECOND } from '../utils/durations.js';
import { filterActiveEventCounts } from '../utils/filterActiveEventCounts.js';
import { resolveDurationSince } from '../utils/resolveDurationSince.js';

import type { Logger } from '@couimet/logger-contract';
import type { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';

export const createGetDashboardStateHandler = (
  queueOrderRepo: QueueOrderRepository,
  eventRepo: EventRepository,
  systemStateRepo: SystemStateRepository,
  pullRequestRepo: PullRequestRepository,
  logger: Logger,
) => {
  return async (req: Request, res: Response): Promise<void> => {
    try {
      const since = resolveDurationSince(req.query.duration);

      const [items, eventCounts, paused, pendingAcknowledgements] = await Promise.all([
        queueOrderRepo.getEffectiveOrder({ eligibleOnly: false, includeRetriggered: true }),
        eventRepo.countByType(since),
        systemStateRepo.isSchedulerPaused(),
        pullRequestRepo.findPendingAcknowledgement(),
      ]);
      const activeEventCounts = filterActiveEventCounts(eventCounts);

      const now = new Date();
      const hasEligibleNow = items.some((item) => item.not_before <= now);
      let nextReviewAvailableAt =
        !hasEligibleNow && items.length > 0
          ? items.reduce((min, item) => (item.not_before < min ? item.not_before : min), items[0].not_before).toISOString()
          : null;

      const awaitingItem = pendingAcknowledgements.length > 0 ? pendingAcknowledgements[0] : null;
      const awaitingAcknowledgement = awaitingItem
        ? {
            repo_full_name: awaitingItem.repo_full_name,
            pr_number: awaitingItem.pr_number,
            pr_title: awaitingItem.title,
            requested_at: awaitingItem.last_review_requested_at.toISOString(),
          }
        : null;

      // If awaiting acknowledgement, the next review cannot happen before the retrigger spacing window closes
      if (awaitingItem) {
        const spacingEnd = new Date(awaitingItem.last_review_requested_at.getTime() + config.SCHEDULER_RETRIGGER_SPACING_SEC * MS_PER_SECOND);
        if (nextReviewAvailableAt === null || spacingEnd.toISOString() > nextReviewAvailableAt) {
          nextReviewAvailableAt = spacingEnd.toISOString();
        }
      }

      res.json({
        nextReviewAvailableAt,
        pendingItems: items,
        eventCounts: activeEventCounts,
        paused,
        awaitingAcknowledgement,
      });
    } catch (error) {
      logger.error({ fn: 'api.dashboardState', error }, 'Failed to get dashboard state');
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: 'Failed to get dashboard state' });
    }
  };
};
