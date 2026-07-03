/**
 * Inversify binding identifiers.
 *
 * Each symbol represents a contract that the container resolves. Add new
 * identifiers here as the service graph grows.
 */
export const TYPES = {
  Config: Symbol.for('Config'),
  CoderabbitGitHubClient: Symbol.for('CoderabbitGitHubClient'),
  EnqueueService: Symbol.for('EnqueueService'),
  EventRepository: Symbol.for('EventRepository'),
  Logger: Symbol.for('Logger'),
  ObservationContextProvider: Symbol.for('ObservationContextProvider'),
  OnDetectedCallback: Symbol.for('OnDetectedCallback'),
  Octokit: Symbol.for('Octokit'),
  PollDetector: Symbol.for('PollDetector'),
  PRStateFetcher: Symbol.for('PRStateFetcher'),
  PrismaClient: Symbol.for('PrismaClient'),
  ProbeFactory: Symbol.for('ProbeFactory'),
  PruneEvaluator: Symbol.for('PruneEvaluator'),
  Pruner: Symbol.for('Pruner'),
  QueueOrderRepository: Symbol.for('QueueOrderRepository'),
  QueueRepository: Symbol.for('QueueRepository'),
  Scheduler: Symbol.for('Scheduler'),
  SystemStateRepository: Symbol.for('SystemStateRepository'),
  // Keep this object alphabetically sorted by key.
} as const;
