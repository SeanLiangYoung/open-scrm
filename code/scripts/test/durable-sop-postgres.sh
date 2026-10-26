#!/usr/bin/env bash
set -euo pipefail
repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
container_name="open-scrm-durable-sop-pg-${$}"
container_id=''
node_pid=''
cleanup(){
 local result=$?
 local cleanup_passed=true
 trap - EXIT INT TERM
 # Reap Node first: its signal handler kills/reaps its own OS workers and closes DB.
 if [[ -n "$node_pid" ]]; then
  if kill -0 "$node_pid" 2>/dev/null; then kill -TERM "$node_pid" 2>/dev/null || true; fi
  wait "$node_pid" 2>/dev/null || true
 fi
 if [[ -n "$container_id" ]]; then
  if ! docker rm -f "$container_id" >/dev/null; then result=1;cleanup_passed=false;fi
  local remaining
  if ! remaining="$(docker ps -a --no-trunc --filter "id=$container_id" --format '{{.ID}}')";then
   result=1;cleanup_passed=false
  elif [[ -n "$remaining" ]];then result=1;cleanup_passed=false;fi
  echo "DURABLE_SOP_CLEANUP container=$container_id passed=$cleanup_passed"
 fi
 exit "$result"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
docker image inspect postgres:16-alpine >/dev/null
# Register ownership before attempting start, so start failure is fully cleanable.
container_id="$(docker create --name "$container_name" --label open-scrm.verification=durable-sop --publish 127.0.0.1::5432 --env POSTGRES_DB=durable_sop --env POSTGRES_USER=durable_verify --env POSTGRES_PASSWORD=disposable_durable_only postgres:16-alpine)"
echo "DURABLE_SOP_OWNED_CONTAINER $container_id"
if [[ "${DURABLE_SOP_FAULT_START:-}" == 1 ]];then
 docker start --open-scrm-forced-invalid-start-option "$container_id" >/dev/null
else
 docker start "$container_id" >/dev/null
fi
for attempt in $(seq 1 60);do
 if docker exec "$container_name" pg_isready -h 127.0.0.1 -U durable_verify -d durable_sop >/dev/null 2>&1;then break;fi
 if [[ "$attempt" == 60 ]];then echo 'Dedicated temporary PG not ready' >&2;exit 1;fi
 sleep 1
done
pg_port="$(docker port "$container_name" 5432/tcp | sed 's/.*://')"
TZ=UTC DURABLE_SOP_PG_PORT="$pg_port" node "$repo_root/code/scripts/test/durable-sop-postgres.cjs" &
node_pid=$!
node_result=0
wait "$node_pid" || node_result=$?
node_pid=''
exit "$node_result"
