#!/usr/bin/env bash
# Prepare a GitHub repo for the factory: AGENTS.md with detected commands, labels, profile.
# Unknown values stay TODO; then run "factory init" in your agent (foreman skill) to fill them.
set -euo pipefail
here=$(cd "$(dirname "$0")" && pwd)
dir=${1:?usage: init.sh <repo-dir> [profile]}
profile=${2:-}   # empty: keep .foreman/profile, else mixed
skill="$here/skills/foreman"
version=$(node -p "require('$here/package.json').version")
[ -z "$profile" ] || [ -f "$skill/profiles/$profile.json" ] || { echo "unknown profile: $profile ($(ls "$skill/profiles" | sed 's/.json//' | xargs))" >&2; exit 1; }
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

mkdir -p .foreman
out=AGENTS.md
[ -e AGENTS.md ] && out=.foreman/AGENTS.template.md   # never overwrite: "factory init" merges the rendered template
REPO=$repo BRANCH=$branch SETUP=$setup TEST=$test GATE=$gate SOURCES=$sources node -e '
const fs = require("fs"); let s = fs.readFileSync(process.argv[1], "utf8");
for (const k of ["REPO", "BRANCH", "SETUP", "TEST", "GATE", "SOURCES"]) s = s.replaceAll("{{" + k + "}}", process.env[k]);
process.stdout.write(s.replaceAll("`TODO`", "TODO"));
' "$here/factory/AGENTS.md" > "$out"
echo "wrote $out (repo $repo, setup: $setup, test: $test, gate: $gate)"
if [ -n "$profile" ]; then echo "$profile" > .foreman/profile
elif [ -s .foreman/profile ]; then profile=$(cat .foreman/profile)
else profile=mixed; echo "$profile" > .foreman/profile; fi
ln -sn AGENTS.md CLAUDE.md 2>/dev/null || true   # Claude Code reads CLAUDE.md; create only, never replace

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
old=$(cat .foreman/version 2>/dev/null || true)
echo "$version" > .foreman/version
echo "labels ready on $repo; profile: $profile; foreman $([ -n "$old" ] && [ "$old" != "$version" ] && echo "$old -> ")$version"
if [ "$out" != AGENTS.md ]; then
  echo "next: ask your agent \"factory init\" to merge $out into AGENTS.md and fill its TODOs"
elif grep -q TODO AGENTS.md; then
  echo "next: ask your agent \"factory init\" to fill the remaining TODOs"
fi
