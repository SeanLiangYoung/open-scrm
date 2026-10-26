#!/usr/bin/env bash
# Isolated disposable integration verification; never uses project DB credentials.
set -euo pipefail
repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
container_name="open-scrm-overnight-service-schema-audit-pg-${$}"
pg_port=''
image='postgres:16-alpine'
container_id=''
cleanup() {
  local result=$?
  trap - EXIT
  if [[ -n "$container_id" ]]; then
    if ! docker rm -f "$container_id" >/dev/null 2>&1; then
      echo "Failed to remove owned verification container: $container_id" >&2
      result=1
    fi
    local remaining
    if ! remaining="$(docker ps -a --no-trunc --filter "id=$container_id" --format '{{.ID}}')"; then
      echo 'Could not verify container cleanup' >&2
      result=1
    elif [[ -n "$remaining" ]]; then
      echo "Owned verification container remains: $remaining" >&2
      result=1
    fi
  fi
  exit "$result"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
docker image inspect "$image" >/dev/null
# No preexisting container is removed or reused. Docker rejects occupied ports.
container_id="$(docker run --rm --detach --name "$container_name" \
  --label open-scrm.verification=overnight-service-schema-audit \
  --publish "127.0.0.1::5432" \
  --env POSTGRES_DB=overnight_schema_audit \
  --env POSTGRES_USER=overnight_verify \
  --env POSTGRES_PASSWORD=disposable_local_verification "$image")"
binding="$(docker port "$container_id" 5432/tcp)"
pg_port="${binding##*:}"
for attempt in $(seq 1 60); do
  if docker exec "$container_name" pg_isready -h 127.0.0.1 -U overnight_verify -d overnight_schema_audit >/dev/null 2>&1; then
    break
  fi
  if [[ "$attempt" == 60 ]]; then
    echo 'Temporary PostgreSQL did not become ready' >&2
    exit 1
  fi
  sleep 1
done
docker exec "$container_name" psql -U overnight_verify -d overnight_schema_audit -Atc 'SELECT version()'
docker exec -i "$container_name" psql -v ON_ERROR_STOP=1 -U overnight_verify -d overnight_schema_audit \
  < "$repo_root/code/scripts/init-db.pg.sql" >/dev/null

audit_dir="$(mktemp -d "${TMPDIR:-/tmp}/open-scrm-service-schema-audit.XXXXXX")"
echo "Artifacts: $audit_dir"
TZ=UTC OVERNIGHT_PG_PORT="$pg_port" SERVICE_SCHEMA_AUDIT_REPORT="$audit_dir/result.json" node "$repo_root/code/scripts/test/overnight-service-schema-audit.cjs"
