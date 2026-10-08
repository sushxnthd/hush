#!/usr/bin/env bash
# CI-only fixture: a new D-Bus session and synthetic keyring, never a user store.
set -euo pipefail
hush_fixture=$(mktemp -d)
trap 'rm -rf "$hush_fixture"' EXIT
export XDG_DATA_HOME="$hush_fixture/data"
export XDG_RUNTIME_DIR="$hush_fixture/runtime"
mkdir -m 700 "$XDG_DATA_HOME" "$XDG_RUNTIME_DIR"
hush_fixture_password='hush-synthetic-ci-keyring-only'
printf '%s' "$hush_fixture_password" | gnome-keyring-daemon --unlock --components=secrets > "$hush_fixture/daemon.env"
node scripts/packaged-keystore-verify.mjs
