#!/usr/bin/env bash
# Install foreman's own skill plus the catalog skills its roles load, globally for Pi.
set -euo pipefail
here=$(cd "$(dirname "$0")" && pwd)

add() { npx -y skills add "$1" --global --agent pi --yes --copy "${@:2}"; }

add legout/skills \
  --skill agent-guardrails --skill systematic-debugging \
  --skill documentation-writer --skill research
add mattpocock/skills --skill tdd
add pbakaus/impeccable --skill impeccable

# foreman's skill is versioned here; link it so `git pull` updates it.
mkdir -p "$HOME/.agents/skills"
ln -sfn "$here/skills/foreman" "$HOME/.agents/skills/foreman"
echo "installed; start a project with: $here/init.sh <repo-dir>"
