/**
 * Inversify binding identifiers.
 *
 * Each symbol represents a contract that the container resolves. Add new
 * identifiers here as the service graph grows.
 */
export const TYPES = {
  CoderabbitCommentRepository: Symbol.for('CoderabbitCommentRepository'),
  Config: Symbol.for('Config'),
  CoderabbitGitHubClient: Symbol.for('CoderabbitGitHubClient'),
  EnqueueService: Symbol.for('EnqueueService'),
  EventCountsMapper: Symbol.for('EventCountsMapper'),
  EventEntryMapper: Symbol.for('EventEntryMapper'),
  EventRepository: Symbol.for('EventRepository'),
  Logger: Symbol.for('Logger'),
  ObservationContextProvider: Symbol.for('ObservationContextProvider'),
  OnDetectedCallback: Symbol.for('OnDetectedCallback'),
  Octokit: Symbol.for('Octokit'),
  PollDetector: Symbol.for('PollDetector'),
  PRStateFetcher: Symbol.for('PRStateFetcher'),
  PrismaClient: Symbol.for('PrismaClient'),
  ProbeFactory: Symbol.for('ProbeFactory'),
  PrScanner: Symbol.for('PrScanner'),
  PruneEvaluator: Symbol.for('PruneEvaluator'),
  Pruner: Symbol.for('Pruner'),
  PullRequestRepository: Symbol.for('PullRequestRepository'),
  QueueItemEnricher: Symbol.for('QueueItemEnricher'),
  QueueItemMapper: Symbol.for('QueueItemMapper'),
  QueueOrderRepository: Symbol.for('QueueOrderRepository'),
  QueueRepository: Symbol.for('QueueRepository'),
  ReviewDetector: Symbol.for('ReviewDetector'),
  ReviewQueueToQueueItemMapper: Symbol.for('ReviewQueueToQueueItemMapper'),
  ReviewTrigger: Symbol.for('ReviewTrigger'),
  Scheduler: Symbol.for('Scheduler'),
  SystemStateRepository: Symbol.for('SystemStateRepository'),
  // Keep this object alphabetically sorted by key.
} as const;
