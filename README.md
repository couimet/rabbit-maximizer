# Rabbit Optimizer

A personal, single-tenant tool that re-requests CodeRabbit reviews on your PRs after you hit CodeRabbit's hourly rate limit, spacing the retries so they actually go through.

[![License](https://img.shields.io/badge/license-MIT-green)](./LICENSE)

## Stack

TypeScript, Node, pnpm, Prisma (SQLite), Octokit. Runs locally as a long-lived process.

## Development

**Prerequisites:** Node >= 24, pnpm.

```bash
# Clone and install
git clone https://github.com/couimet/rabbit-optimizer.git
cd rabbit-optimizer
pnpm install

# Configure
cp .env.example .env
# Edit .env — fill in GITHUB_PAT with a fine-grained user PAT

# Set up the database
pnpm db:migrate

# Run
pnpm dev
```
