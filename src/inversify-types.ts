/**
 * Inversify binding identifiers.
 *
 * Each symbol represents a contract that the container resolves. Add new
 * identifiers here as the service graph grows.
 */
export const TYPES = {
  CoderabbitGitHubClient: Symbol.for('CoderabbitGitHubClient'),
  EventRepository: Symbol.for('EventRepository'),
  Logger: Symbol.for('Logger'),
  ObservationContextProvider: Symbol.for('ObservationContextProvider'),
  Octokit: Symbol.for('Octokit'),
  PollDetector: Symbol.for('PollDetector'),
  PrismaClient: Symbol.for('PrismaClient'),
  ProbeFactory: Symbol.for('ProbeFactory'),
  QueueRepository: Symbol.for('QueueRepository'),
  // Keep this object alphabetically sorted by key.
} as const;
