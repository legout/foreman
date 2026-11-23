#!/usr/bin/env bash
# One-time machine setup for the foreman factory. Idempotent; re-run to update.
#   ./setup.sh                        Pi only (default)
#   ./setup.sh --agents pi,claude-code,codex,opencode,hermes-agent
# Agent ids are those of `npx skills` (omp reads ~/.agents/skills, so `pi` covers it).
set -euo pipefail
here=$(cd "$(dirname "$0")" && pwd)
agents=pi
[ "${1:-}" = --agents ] && agents=${2:?agent list}

need() { command -v "$1" >/dev/null || { echo "missing: $1 ($2)" >&2; missing=1; }; }
missing=0
need hc  "herdr-core: https://github.com/herdrdev/herdr-app"
need gh  "https://cli.github.com, then: gh auth login"
need npx "Node.js 20+"
need git "git"
[ "$missing" = 0 ] || exit 1

agent_args=(); IFS=, read -ra list <<<"$agents"; for a in "${list[@]}"; do agent_args+=(--agent "$a"); done
skills() { npx -y skills add "$1" --global "${agent_args[@]}" --yes --copy "${@:2}"; }

# Skills for every selected agent (one upstream owner each; `npx skills update -g` refreshes).
skills "$here" --skill foreman
# workers: evidence rules, TDD, debugging, UI, docs, research
skills legout/skills --skill agent-guardrails --skill systematic-debugging \
  --skill documentation-writer --skill research
skills mattpocock/skills --skill tdd
skills pbakaus/impeccable --skill impeccable
# owner: idea -> spec -> plan; upkeep; per-project verify recipes; releases
skills legout/skills --skill shape-design --skill planning-contract \
  --skill write-implementation-plan --skill domain-modeling --skill grilling \
  --skill deslop --skill test-diet --skill project-verification --skill make-release

# Pi extras: /to-issues, /factory-* prompt commands (the package) and in-session subagents.
if [[ ",$agents," == *,pi,* ]] && command -v pi >/dev/null; then
  pi install "${FOREMAN_SOURCE:-git:github.com/legout/foreman}"
  pi install npm:pi-subagents
fi

"$here/doctor.sh" "$agents"
