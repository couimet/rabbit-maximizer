#!/usr/bin/env bash
# Run the built image and confirm the container serves the dashboard. The build
# job proves the tree compiles; this proves the image runs, so a file missing
# from the runtime stage or a broken entrypoint fails CI instead of the first
# release.
#
# The container reads its configuration from the file mounted at /app/.env, not
# from --env-file: the image sets DATABASE_URL to the data volume, and a mounted
# file leaves that value alone while --env-file overrides it with the relative
# path in the repository's own file.
#
# Environment:
#   IMAGE_REF   image to run, for example rabbit-maximizer:ci
#   ENV_FILE    configuration file to mount, for example .env.ci
set -euo pipefail

IMAGE_REF="${IMAGE_REF:?IMAGE_REF is required}"
ENV_FILE="${ENV_FILE:?ENV_FILE is required}"

CONTAINER_NAME='rabbit-maximizer-smoke'
HEALTH_POLL_COUNT=30
HEALTH_POLL_INTERVAL_SEC=2
HEALTH_PATH='/api/summary'

if [ ! -f "$ENV_FILE" ]; then
  echo "configuration file not found at $ENV_FILE" >&2
  exit 1
fi

# Docker reads a relative bind source as a named volume, so resolve the path.
ENV_FILE_ABS="$(cd "$(dirname "$ENV_FILE")" && pwd)/$(basename "$ENV_FILE")"

cleanup() {
  docker rm -v -f "$CONTAINER_NAME" >/dev/null 2>&1 || true
}
trap cleanup EXIT

cleanup

echo 'Checking that the entrypoint refuses a missing data mount...'
guard_status=0
guard_output="$(docker run --rm "$IMAGE_REF" 2>&1)" || guard_status=$?

if [ "$guard_status" -eq 0 ] || [[ "$guard_output" != *'is not a mount'* ]]; then
  echo "FAIL: expected a refusal to start without a data mount, got exit $guard_status" >&2
  echo "$guard_output" >&2
  exit 1
fi
echo 'PASS: the entrypoint refused to start without a data mount'

echo "Starting $IMAGE_REF..."
# The anonymous volume gives the mount guard a real mount and disappears with
# the container, so the smoke test leaves no volume behind.
docker run -d --name "$CONTAINER_NAME" --volume /data --volume "$ENV_FILE_ABS:/app/.env:ro" "$IMAGE_REF" >/dev/null

echo "Waiting for $HEALTH_PATH to answer..."
served='false'
for _ in $(seq "$HEALTH_POLL_COUNT"); do
  if docker exec "$CONTAINER_NAME" node -e "fetch('http://127.0.0.1:' + process.env.WEB_PORT + '$HEALTH_PATH').then((response) => process.exit(response.ok ? 0 : 1)).catch(() => process.exit(1))" >/dev/null 2>&1; then
    served='true'
    break
  fi
  sleep "$HEALTH_POLL_INTERVAL_SEC"
done

if [ "$served" != 'true' ]; then
  echo "FAIL: the dashboard did not answer within $((HEALTH_POLL_COUNT * HEALTH_POLL_INTERVAL_SEC))s" >&2
  docker logs "$CONTAINER_NAME" >&2
  exit 1
fi
echo "PASS: the dashboard answered on $HEALTH_PATH"

echo 'Stopping the container...'
docker stop "$CONTAINER_NAME" >/dev/null
exit_code="$(docker inspect --format '{{.State.ExitCode}}' "$CONTAINER_NAME")"

if [ "$exit_code" != '0' ]; then
  echo "FAIL: the container exited with $exit_code after SIGTERM" >&2
  exit 1
fi
echo 'PASS: the container stopped cleanly'
