#!/usr/bin/env bash
# One-time machine setup for the foreman factory. Idempotent; re-run to update.
set -euo pipefail
here=$(cd "$(dirname "$0")" && pwd)

need() { command -v "$1" >/dev/null || { echo "missing: $1 ($2)" >&2; missing=1; }; }
missing=0
need pi    "https://pi.dev"
need hc    "herdr-core: https://github.com/herdrdev/herdr-app"
need gh    "https://cli.github.com, then: gh auth login"
need npx   "Node.js 20+"
need git   "git"
[ "$missing" = 0 ] || exit 1

# Pi packages: session messaging, in-session subagents, and this package (skill + prompts).
pi install npm:pi-intercom
pi install npm:pi-subagents
pi install npm:skill-diet
pi install "${FOREMAN_SOURCE:-git:github.com/legout/foreman}"

# Skills, installed globally into ~/.agents/skills (one owner each; `npx skills update -g` refreshes them).
skills() { npx -y skills add "$1" --global --agent pi --yes --copy "${@:2}"; }
# workers: evidence rules, TDD, debugging, UI, docs, research
skills legout/skills --skill agent-guardrails --skill systematic-debugging \
  --skill documentation-writer --skill research
skills mattpocock/skills --skill tdd
skills pbakaus/impeccable --skill impeccable
# owner: idea -> spec -> plan (then /to-issues); upkeep; per-project verify recipes
skills legout/skills --skill shape-design --skill planning-contract \
  --skill write-implementation-plan --skill domain-modeling --skill grilling \
  --skill deslop --skill test-diet --skill project-verification --skill make-release

"$here/doctor.sh"
