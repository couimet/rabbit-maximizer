# Publishing

How a Rabbit Maximizer release is cut. The release artifact is the container image on GHCR. Nothing publishes to npm, and `package.json` stays `private: true`.

## Versions

The project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html). A release tag has the form `vX.Y.Z`, with an optional prerelease suffix. The suffix ladder is `alpha` < `beta` < `rc`.

A tag without a suffix is a stable release. A tag with a suffix is a prerelease, and GitHub marks it with `--prerelease`.

## Image tags

The image is `ghcr.io/couimet/rabbit-maximizer`. `scripts/docker/derive-image-tags.sh` owns the tag rule, and `.github/workflows/publish-image.yml` reads that script. Read the script when the rule and this table disagree.

| Release kind                            | Tags published           |
| --------------------------------------- | ------------------------ |
| Stable, for example `v1.2.3`            | `1.2.3`, `1.2`, `latest` |
| Prerelease, for example `v1.2.3-beta.1` | `1.2.3-beta.1`, `beta`   |
| Manual dispatch                         | `edge`, `sha-<short>`    |

`latest`, `beta`, and `edge` move. The version tags stay where the release put them.

## Lifecycle

Three phases:

1. **Development.** Work lands on a branch. Nothing publishes.
2. **Beta.** A prerelease for collaborators. The container image publishes under the version tag and moves `beta`.
3. **Stable.** A release for operators. The image publishes under the version tag, the major and minor tag, and moves `latest`.

## Cut a beta

1. Confirm that CI passed on the commit you will tag.
2. Write the changelog section by hand as `## [X.Y.Z-beta.N] - YYYY-MM-DD`. `pnpm release:lock` accepts stable versions only, so no script writes a prerelease section. See [The changelog](#the-changelog).
3. Commit the section.
4. Create the tag: `git tag -a vX.Y.Z-beta.N -m "vX.Y.Z-beta.N"`
5. Push the tag: `git push origin vX.Y.Z-beta.N`
6. Create the release: `gh release create vX.Y.Z-beta.N --prerelease --title "vX.Y.Z-beta.N"`

The publish workflow reacts to the published release. It pushes the version tag and moves `beta`.

## Cut a stable release

1. Confirm that CI passed on the commit you will tag.
2. Lock the version: `pnpm release:lock X.Y.Z`
3. Commit the result. The script rewrites the changelog heading, syncs the version in `docs/api-spec.yaml`, and sets `version` in `package.json`.
4. Generate the instructions: `pnpm release:instructions`
5. Follow the generated file. It lists the phases in order: smoke test the image, create the tag, create the release, wait for the publish workflow, verify the published tags, pull and run the image, and commit the generated file.

The generated file lands in `publishing-instructions/publish-vX.Y.Z.md` and is committed with the release. It records what the release ran, so a later reader can see the commands that produced a published image.

## Start the next cycle

After the stable release, run `pnpm release:start`. It adds a fresh `## [Unreleased]` section above the newest version heading and restores the compare-form reference link. The script refuses to run when an `[Unreleased]` section is already present.

## Ad-hoc images

An ad-hoc image tests an evolution that is not ready for a release. `pnpm docker:push:adhoc:<target>` builds the image from the working tree and pushes it to GHCR under a tag of its own. Another machine pulls that tag.

The tag carries the commit and a UTC timestamp: `<short>-YYYYMMDD-HHMMSS`, for example `0123456-20261003-143005`. `<short>` is the first seven characters of the commit. The commit alone does not identify the build, because the working tree usually holds changes the commit does not, and because one commit produces many builds while you iterate. The timestamp separates those builds, so a new push never replaces an image that is still in use. Two builds in the same second share one tag, and the second push replaces the first.

The command pushes one tag and moves no other tag. `latest`, `beta`, and `edge` keep the images the release process gave them.

Log in to GHCR once before the first push. Use a personal access token with the `write:packages` scope as the password:

```bash
docker login ghcr.io
```

The registry refuses a push with `unauthorized: unauthenticated: User cannot be authenticated with the token provided.` when the login is absent, when the token expired, or when the token lacks the `write:packages` scope.

Name the target platform. The command takes one of three:

| Target  | Builds                     | Push behavior                           |
| ------- | -------------------------- | --------------------------------------- |
| `amd64` | Intel and AMD hosts        | loads into the local store, then pushes |
| `arm64` | ARM hosts                  | loads into the local store, then pushes |
| `both`  | both, as one manifest list | pushes during the build                 |

Build the image from the current working tree and push it:

```bash
pnpm docker:push:adhoc:amd64
```

The command prints the image reference. On the other machine, pull that reference and run the container with the command from the "Run with Docker" section of [README.md](README.md), with the ad-hoc tag in place of `latest`:

```bash
docker pull ghcr.io/couimet/rabbit-maximizer:0123456-20261003-143005
```

Find the architecture of the host that will run the image with `docker info --format '{{.Architecture}}'`. Docker emulates a foreign platform, so a build for the other architecture takes longer than a native one.

A single-platform target loads into the local store before it pushes, so a refused push leaves the image behind and one `docker push <reference>` finishes the job after the login. The script prints that command when the push fails. The docker exporter refuses a manifest list in the local store, so `both` pushes during the build instead, and a refused push leaves no local image to retry.

Every log record carries the commit and the image tag, so a running ad-hoc image identifies itself.

## The changelog

`CHANGELOG.md` follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

- A beta gets its own section, written by hand, and the section stays in the file after the stable release ships.
- The stable section repeats every entry since the last stable release, so it reads as the complete record of that version. It does not point at the beta section for the rest.
- `lock-version.sh` renames the `## [Unreleased]` heading and rewrites the reference link. It never writes a prerelease heading.

## The release gate

`.github/workflows/publish-image.yml` refuses to publish a tagged commit whose checks did not pass. `scripts/release/verify-ci-status.sh` reads the check runs for the commit, waits while a run is still in progress, and exits non-zero when a run concluded as a failure, a cancellation, or a timeout.

The gate applies to the `release` event only. A manual dispatch publishes `edge`, which the README documents as a build that can break at any time.

A release starts seconds after the tag push, so the wait covers a commit whose check runs do not exist yet. The gate refuses that commit when the same wait ends with no check run at all.

## Notes

- **A migration that fails on populated data passes CI.** `scripts/validate-migrations.sh` applies every migration to a fresh database. Check a migration against a copy of real data before you tag.
- **The GHCR package inherits its visibility from the repository.** A `docker pull` that asks for credentials needs the package visibility changed in the package settings.
- **The operator upgrade behavior lives in the README.** See the "Upgrading" section of [README.md](README.md) for the migration-on-start rules, the `SKIP_MIGRATIONS` escape, and the backup commands.
