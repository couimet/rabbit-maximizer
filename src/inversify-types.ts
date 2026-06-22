/**
 * Inversify binding identifiers.
 *
 * Each symbol represents a contract that the container resolves. Add new
 * identifiers here as the service graph grows.
 */
export const TYPES = {
  CoderabbitGitHubClient: Symbol.for('CoderabbitGitHubClient'),
  EnqueueService: Symbol.for('EnqueueService'),
  EventRepository: Symbol.for('EventRepository'),
  Logger: Symbol.for('Logger'),
  ObservationContextProvider: Symbol.for('ObservationContextProvider'),
  OnDetectedCallback: Symbol.for('OnDetectedCallback'),
  Octokit: Symbol.for('Octokit'),
  PollDetector: Symbol.for('PollDetector'),
  PrismaClient: Symbol.for('PrismaClient'),
  ProbeFactory: Symbol.for('ProbeFactory'),
  QueueRepository: Symbol.for('QueueRepository'),
  Scheduler: Symbol.for('Scheduler'),
  // Keep this object alphabetically sorted by key.
} as const;
