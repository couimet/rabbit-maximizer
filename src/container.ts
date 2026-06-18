import "reflect-metadata";
import { Container } from "inversify";
import { Octokit } from "@octokit/rest";
import { getLogger, type Logger } from "@couimet/logger-contract";
import { config } from "./config.js";
import { TYPES } from "./inversify-types.js";
import { CoderabbitGitHubClientImpl } from "./github/index.js";
import type { CoderabbitGitHubClient } from "./github/index.js";

const container = new Container();

// External dependencies
container
  .bind<Octokit>(TYPES.Octokit)
  .toDynamicValue(() => new Octokit({ auth: config.GITHUB_PAT }))
  .inSingletonScope();

container
  .bind<Logger>(TYPES.Logger)
  .toDynamicValue(() => getLogger())
  .inSingletonScope();

// Services
container
  .bind<CoderabbitGitHubClient>(TYPES.CoderabbitGitHubClient)
  .to(CoderabbitGitHubClientImpl)
  .inSingletonScope();

export { container };

/** Convenience helper for non-decorator contexts (e.g. main.ts). */
export const getService = <T>(identifier: symbol): T =>
  container.get<T>(identifier);
