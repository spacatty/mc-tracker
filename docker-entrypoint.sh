#!/bin/sh
set -e

# SQLite needs write access to the data folder (for the -wal/-shm files) and the
# database file. A bind-mounted ./data keeps its host owner, so run the app as
# that owner instead of a fixed uid. A root-owned folder is handed to `node`.
DATA_DIR="$(dirname "${SQLITE_PATH:-/app/data/mc-tracker.sqlite}")"
case "$DATA_DIR" in /*) ;; *) DATA_DIR="/app/$DATA_DIR" ;; esac

if [ "$(id -u)" = "0" ]; then
  mkdir -p "$DATA_DIR"
  uid="$(stat -c %u "$DATA_DIR")"
  gid="$(stat -c %g "$DATA_DIR")"
  if [ "$uid" = "0" ]; then
    chown -R node:node "$DATA_DIR" 2>/dev/null || true
    uid=1000
    gid=1000
  fi
  # Leftovers from an earlier run as another user (e.g. root-owned -wal/-shm).
  find "$DATA_DIR" ! -user "$uid" -exec chown "$uid:$gid" {} + 2>/dev/null || true
  exec setpriv --reuid="$uid" --regid="$gid" --clear-groups "$@"
fi

exec "$@"
