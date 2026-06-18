# CodeRabbit Optimizer

A personal, single-tenant tool that re-requests CodeRabbit reviews on your PRs after you hit CodeRabbit's hourly rate limit, spacing the retries so they actually go through.

[![License](https://img.shields.io/badge/license-MIT-green)](./LICENSE)

> [!NOTE]
> Active development — see the [tracking issue](https://github.com/couimet/coderabbit-optimizer/issues/1) for status and design context.

## Stack

TypeScript, Node, pnpm, Prisma (SQLite), Octokit. Runs locally as a long-lived process. Docker deployment deferred to a later issue.
