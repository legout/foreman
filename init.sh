#!/usr/bin/env bash
# Prepare a GitHub repo for the factory: AGENTS.md with detected commands, labels, profile.
# Unknown values stay TODO; then run "factory init" in your agent (foreman skill) to fill them.
set -euo pipefail
here=$(cd "$(dirname "$0")" && pwd)
dir=${1:?usage: init.sh <repo-dir> [profile]}
profile=${2:-mixed}
skill="$here/skills/foreman"
[ -f "$skill/profiles/$profile.json" ] || { echo "unknown profile: $profile ($(ls "$skill/profiles" | sed 's/.json//' | xargs))" >&2; exit 1; }
cd "$dir"
repo=$(gh repo view --json nameWithOwner -q .nameWithOwner)
branch=$(gh repo view --json defaultBranchRef -q .defaultBranchRef.name)

# Detect the obvious; leave the rest TODO. First match wins.
setup=TODO test=TODO gate=TODO
if [ -f package.json ]; then
  pm=npm; [ -f pnpm-lock.yaml ] && pm=pnpm; [ -f bun.lock ] || [ -f bun.lockb ] && pm=bun
  setup="$pm install"
  has() { node -e "process.exit(require('./package.json').scripts?.['$1']?0:1)" 2>/dev/null; }
  for s in test test:unit test:node; do has $s && { test="$pm run $s -- <path>"; break; }; done
  gates=""; for s in lint typecheck test build; do has $s && gates+="${gates:+ && }$pm run $s"; done
  [ -n "$gates" ] && gate=$gates
  for s in ci check; do has $s && { gate="$pm run $s"; break; }; done
elif [ -f pyproject.toml ]; then
  if [ -f uv.lock ]; then setup="uv sync"; run="uv run "; else setup="pip install -e ."; run=""; fi
  test="${run}pytest <path>"
  gate="${run}pytest"; grep -q '\[tool.ruff' pyproject.toml && gate="${run}ruff check && $gate"
elif [ -f Cargo.toml ]; then setup="cargo build"; test="cargo test <name>"; gate="cargo clippy && cargo test"
elif [ -f go.mod ]; then setup="go mod download"; test="go test ./<pkg>"; gate="go vet ./... && go test ./..."
fi
if [ -f Makefile ] && grep -qE '^(check|ci):' Makefile; then gate="make $(grep -oE '^(check|ci):' Makefile | head -1 | tr -d :)"; fi
sources=TODO
src=""; for p in project docs/specs docs/adr CONTEXT.md; do [ -e "$p" ] && src+="${src:+, }\`$p\`"; done
[ -n "$src" ] && sources=$src

if [ -e AGENTS.md ]; then
  echo "AGENTS.md exists; merge $here/factory/AGENTS.md by hand" >&2
else
  REPO=$repo BRANCH=$branch SETUP=$setup TEST=$test GATE=$gate SOURCES=$sources python3 - "$here/factory/AGENTS.md" > AGENTS.md <<'PY'
import os, sys
s = open(sys.argv[1]).read()
for k in ("REPO", "BRANCH", "SETUP", "TEST", "GATE", "SOURCES"):
    s = s.replace("{{%s}}" % k, os.environ[k])
print(s.replace("`TODO`", "TODO"), end="")
PY
  echo "wrote AGENTS.md (repo $repo, setup: $setup, test: $test, gate: $gate)"
fi
mkdir -p .foreman && echo "$profile" > .foreman/profile
ln -sfn AGENTS.md CLAUDE.md 2>/dev/null || true   # Claude Code reads CLAUDE.md

while IFS='|' read -r name color desc; do
  gh label create "$name" --color "$color" --description "$desc" --force >/dev/null
done <<'EOF'
lane:quick|c2e0c6|Mechanical, no new behavior
lane:standard|0e8a16|Bounded behavior change, TDD
lane:deep|5319e7|Tester, builder, review, verify
lane:spike|fbca04|Research before specifying
status:ready|1d76db|Dispatchable
status:active|0052cc|Owned by a worker
status:review|bfdadc|PR waiting on its gate
needs:owner|d93f0b|Waits on a human decision
ui|f9d0c4|Visual builder
docs|0075ca|Docs writer
EOF
echo "labels ready on $repo; profile: $profile"
grep -q TODO AGENTS.md && echo "next: ask your agent \"factory init\" to fill the remaining TODOs" || true
