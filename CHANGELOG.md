<!-- markdownlint-disable MD024 -->

# Changelog

All notable changes to Rabbit Maximizer will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

A prerelease gets its own section here. Write it by hand as `## [X.Y.Z-beta.N] - YYYY-MM-DD`, because `pnpm release:lock` accepts stable versions only. The section stays in this file after the stable release ships, and the stable section that follows repeats every entry since the last stable release, so it reads as the complete record of that version.

## [Unreleased]

### Added

- **Review-limit detection** - the poll detector searches every watched repository for CodeRabbit review-limit comments and reads the wait time from each one
- **Automatic retrigger** - the scheduler posts `@coderabbitai full review` on each pull request when its cooldown ends, on an interval independent of the detector
- **Review-on-request support** - a repository below ten stars receives a "Review available on request" comment instead of an automatic review. The detector recognizes that comment and enqueues the trigger through the same queue
- **A queue the operator orders** - the dashboard reorders the pending items, and the scheduler follows that order
- **Terminal states with a reason** - an item resolves when its pull request merges or closes, and the record names which of the two happened
- **Manual control** - retrigger one item immediately, mark an item reviewed, or pause the whole system from the dashboard
- **Live dashboard** on port 3000 with:
  - the countdown to the next retrigger
  - the reorderable pending queue
  - an activity list with event counts over a selectable window
  - the tracked pull requests
  - a timeline of every event, newest first, with client-side repository and pull-request filters
  - a run filter, so a run id copied from a posted comment narrows the timeline to one cycle
- **One run identity** - every log record and every posted comment carries the same run id, so one cycle is traceable end to end
- **Container deployment** - a published image on GHCR with a shipped `compose.yml`, running as the unprivileged user `rabbit` with a read-only root filesystem
- **Startup guards** - the entrypoint refuses to start when the configuration file is a directory or when the data directory is not a mount, because Docker hides both mistakes
- **Move the data volume between hosts** - `pnpm docker:move-data:export <file>` writes the volume to an archive and `pnpm docker:move-data:import <file>` restores it. The import refuses an archive that holds no database and takes a safety export before it replaces a database. The image carries the helper at `/app/scripts/docker/volume.sh`, so an operator without a clone of the repository moves a volume with `docker run --entrypoint`

[Unreleased]: https://github.com/couimet/rabbit-maximizer/commits/main
