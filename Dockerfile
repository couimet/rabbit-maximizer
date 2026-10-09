FROM node:24-bookworm-slim AS build

WORKDIR /app

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH

RUN corepack enable && corepack prepare pnpm@10.19.0 --activate

# better-sqlite3 is a native module and compiles during install.
RUN apt-get update \
  && apt-get install -y --no-install-recommends build-essential python3 \
  && rm -rf /var/lib/apt/lists/*

# prisma.config.ts calls env('DATABASE_URL') and the postinstall hook loads it,
# so the variable must hold a value before `pnpm install` runs.
ENV DATABASE_URL=file:/tmp/build.db

COPY package.json pnpm-lock.yaml prisma.config.ts ./
COPY prisma ./prisma

RUN pnpm install --frozen-lockfile

COPY . .

# A prerelease version must never reach package.json on main: guard-versions
# rejects it. The image therefore carries its own version, and the repository
# keeps the last stable one.
ARG VERSION=
RUN if [ -n "$VERSION" ]; then npm pkg set "version=$VERSION"; fi

# `pnpm clean` runs `jest --clearCache`, so this needs devDependencies.
RUN pnpm build

RUN pnpm prune --prod

FROM node:24-bookworm-slim AS runtime

WORKDIR /app

# Arguments do not cross a stage boundary, so the runtime stage declares the
# three values again to reach the environment and the labels below.
ARG VERSION=
ARG GIT_SHA=
ARG IMAGE_TAGS=

ENV NODE_ENV=production \
    DATABASE_URL=file:/data/rabbit-maximizer.db \
    RABBIT_MAXIMIZER_DATA_DIR=/data \
    RABBIT_MAXIMIZER_LOGS_DIR=/logs \
    LOG_TO_FILE=false \
    RUN_KIND=docker \
    GIT_SHA=$GIT_SHA \
    IMAGE_TAGS=$IMAGE_TAGS \
    WEB_PORT=3000

# The image cannot name its own digest, because embedding it would change it.
# These labels carry the identity that is known at build time.
LABEL org.opencontainers.image.revision="$GIT_SHA" \
      org.opencontainers.image.version="$VERSION" \
      org.opencontainers.image.source="https://github.com/couimet/rabbit-maximizer"

# Without the openssl binary the Prisma engine cannot detect the libssl version
# and warns on every migration.
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*

# The data directory belongs to the image user, so Docker copies that ownership
# when it creates the named volume.
RUN groupadd --gid 1001 rabbit \
  && useradd --uid 1001 --gid 1001 --create-home rabbit \
  && mkdir -p /data /logs \
  && chown rabbit:rabbit /data /logs

COPY --from=build --chown=rabbit:rabbit /app/node_modules ./node_modules
COPY --from=build --chown=rabbit:rabbit /app/dist ./dist
COPY --from=build --chown=rabbit:rabbit /app/package.json ./package.json
COPY --from=build --chown=rabbit:rabbit /app/prisma.config.ts ./prisma.config.ts
COPY --from=build --chown=rabbit:rabbit /app/prisma ./prisma
COPY --from=build --chown=rabbit:rabbit /app/scripts/db ./scripts/db
COPY --from=build --chown=rabbit:rabbit /app/scripts/docker/entrypoint.sh ./scripts/docker/entrypoint.sh
# The volume helper ships in the image, so an operator without a clone of the
# repository restores a volume by naming the image they already pulled.
COPY --from=build --chown=rabbit:rabbit /app/scripts/docker/volume.sh ./scripts/docker/volume.sh

RUN chmod +x ./scripts/docker/entrypoint.sh ./scripts/docker/volume.sh

USER rabbit

# No VOLUME line on purpose. A declared volume hides a missing -v behind an
# anonymous volume that the operator cannot find by name, and the entrypoint
# refuses to start when the data directory is not a mount.

EXPOSE 3000

ENTRYPOINT ["/app/scripts/docker/entrypoint.sh"]
