#!/usr/bin/env bash
# Prepare a GitHub repo for the factory: AGENTS.md (never overwritten) and the labels.
set -euo pipefail
here=$(cd "$(dirname "$0")" && pwd)
dir=${1:?usage: init.sh <repo-dir>}
cd "$dir"
repo=$(gh repo view --json nameWithOwner -q .nameWithOwner)

if [ -e AGENTS.md ]; then
  echo "AGENTS.md exists; merge $here/factory/AGENTS.md by hand" >&2
else
  sed "s|<owner/repo>\` (TODO)|$repo\`|" "$here/factory/AGENTS.md" > AGENTS.md
  echo "wrote AGENTS.md; fill in the remaining TODOs"
fi

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
echo "labels ready on $repo"
