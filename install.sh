#!/usr/bin/env bash
# curl -fsSL https://raw.githubusercontent.com/legout/foreman/main/install.sh | bash [-s -- --agents pi,claude-code]
# Clones (or updates) foreman into $FOREMAN_HOME, then runs its setup.sh with your arguments.
set -euo pipefail
dir=${FOREMAN_HOME:-$HOME/.local/share/foreman}
command -v git >/dev/null || { echo "missing: git" >&2; exit 1; }
if [ -d "$dir/.git" ]; then
  git -C "$dir" pull --ff-only --quiet
else
  git clone --quiet https://github.com/legout/foreman "$dir"
fi
FOREMAN_SOURCE="${FOREMAN_SOURCE:-git:github.com/legout/foreman}" "$dir/setup.sh" "$@"
echo "foreman in $dir; per project: $dir/init.sh <repo-dir> [profile]"
