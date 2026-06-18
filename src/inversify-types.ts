/**
 * Inversify binding identifiers.
 *
 * Each symbol represents a contract that the container resolves. Add new
 * identifiers here as the service graph grows.
 */
export const TYPES = {
  Logger: Symbol.for("Logger"),
  Octokit: Symbol.for("Octokit"),
  CoderabbitGitHubClient: Symbol.for("CoderabbitGitHubClient"),
} as const;
