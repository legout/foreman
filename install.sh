#!/usr/bin/env bash
# curl -fsSL https://raw.githubusercontent.com/legout/foreman/main/install.sh | bash [-s -- --agents pi,claude-code]
# Clones (or updates) foreman into $FOREMAN_HOME, then runs its setup.sh with your arguments.
# FOREMAN_REF=v0.2.0 pins a release tag; without it, foreman follows main.
set -euo pipefail
dir=${FOREMAN_HOME:-$HOME/.local/share/foreman}
ref=${FOREMAN_REF:-}
command -v git >/dev/null || { echo "missing: git" >&2; exit 1; }
[ -d "$dir/.git" ] || git clone --quiet https://github.com/legout/foreman "$dir"
git -C "$dir" fetch --quiet --tags origin
if [ -n "$ref" ]; then
  git -C "$dir" checkout --quiet --detach "$ref"
else
  git -C "$dir" checkout --quiet main && git -C "$dir" merge --quiet --ff-only origin/main
fi
FOREMAN_SOURCE="${FOREMAN_SOURCE:-git:github.com/legout/foreman${ref:+@$ref}}" "$dir/setup.sh" "$@"
echo "foreman $(node -p "require('$dir/package.json').version") in $dir; per project: $dir/init.sh <repo-dir> [profile]"
