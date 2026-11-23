#!/usr/bin/env bash
# Check that this machine can run the factory. Exit 1 on any failure.
set -uo pipefail
fail=0
ok()  { printf '  ok    %s\n' "$1"; }
bad() { printf '  FAIL  %s -> %s\n' "$1" "$2"; fail=1; }
chk() { if eval "$2" >/dev/null 2>&1; then ok "$1"; else bad "$1" "$3"; fi; }

echo "tools"
chk "gh authenticated"   "gh auth status"           "gh auth login"
chk "herdr-core running" "hc ls"                    "start the Herdr app"
chk "pi"                 "pi --version"             "install pi"

echo "pi packages"
list=$(pi list 2>/dev/null)
for p in pi-intercom pi-subagents foreman; do
  grep -q "$p" <<<"$list" && ok "$p" || bad "$p" "re-run setup.sh"
done

echo "skills"
for s in agent-guardrails tdd systematic-debugging impeccable documentation-writer research \
         shape-design planning-contract write-implementation-plan deslop test-diet project-verification; do
  [ -f "$HOME/.agents/skills/$s/SKILL.md" ] && ok "$s" || bad "$s" "re-run setup.sh"
done

echo "models (first entry of each role chain; fallbacks are fine)"
models=$(pi --list-models 2>/dev/null)
for m in "zai glm-5.3-flash" "claude-code claude-sonnet-5-5" "claude-code claude-opus-5-5" \
         "openai-codex gpt-6.2-sol" "openai-codex gpt-6.1-terra"; do
  grep -qE "^${m% *} +${m#* } " <<<"$models" && ok "$m" || printf '  warn  %s unavailable; edit references/roles.md\n' "$m"
done

exit $fail
