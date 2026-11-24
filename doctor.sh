#!/usr/bin/env bash
# Check that this machine can run the factory. Usage: doctor.sh [agents, default pi]. Exit 1 on failure.
set -uo pipefail
here=$(cd "$(dirname "$0")" && pwd)
agents=${1:-pi}
fail=0
ok()   { printf '  ok    %s\n' "$1"; }
bad()  { printf '  FAIL  %s -> %s\n' "$1" "$2"; fail=1; }
warn() { printf '  warn  %s\n' "$1"; }
chk()  { if eval "$2" >/dev/null 2>&1; then ok "$1"; else bad "$1" "$3"; fi; }

version=$(node -p "require('$here/package.json').version")
echo "foreman $version"
if [ -f .foreman/version ] && [ "$(cat .foreman/version)" != "$version" ]; then
  warn "this project was initialised with foreman $(cat .foreman/version); re-run init.sh here, then /factory-init"
fi
echo "tools"
chk "gh authenticated"   "gh auth status" "gh auth login"
echo "hosts (at least one)"
hosts=0
command -v hc    >/dev/null && { chk "herdr-core running" "hc ls" "start the Herdr app"; hosts=1; }
command -v paseo >/dev/null && { chk "paseo daemon" "paseo status" "paseo start"; hosts=1; }
command -v bb    >/dev/null && { chk "bb server" "bb status --json" "start BB"; hosts=1; }
[ $hosts = 1 ] || bad "worker host" "install Herdr (hc), Paseo, or BB"

echo "skills (~/.agents/skills)"
skills=$(grep -oE -- '--skill [a-z-]+' "$here/setup.sh" | cut -d' ' -f2)   # one list: whatever setup.sh installs
[ -n "$skills" ] || bad "setup.sh" "cannot read the skill list"
for s in $skills; do
  [ -f "$HOME/.agents/skills/$s/SKILL.md" ] && ok "$s" || bad "$s" "re-run setup.sh"
done

echo "agent CLIs"
IFS=, read -ra list <<<"$agents"
for a in "${list[@]}"; do
  cli=${a%-code}; cli=${cli%-agent}       # claude-code -> claude, hermes-agent -> hermes
  command -v "$cli" >/dev/null && ok "$cli" || bad "$cli" "install it or drop it from --agents"
done

if [[ ",$agents," == *,pi,* ]] && command -v pi >/dev/null; then
  echo "pi models of profile ${FOREMAN_PROFILE:-mixed} (first entry per role; fallbacks are fine)"
  models=$(pi --list-models 2>/dev/null | awk 'NR>1{print $1"/"$2}')
  node -e '
const have = new Set(process.argv[2].split(/\s+/).filter(Boolean));
for (const [role, chain] of Object.entries(require(process.argv[1]).roles)) {
  const first = chain[0].model;
  if (have.has(first)) console.log(`  ok    ${role}: ${first}`);
  else if (chain.some(e => have.has(e.model))) console.log(`  warn  ${role}: ${first} missing, falls back`);
  else { console.log(`  FAIL  ${role}: no model of its chain in pi`); process.exitCode = 1; break; }
}' "$here/skills/foreman/profiles/${FOREMAN_PROFILE:-mixed}.json" "$models" || fail=1
fi
exit $fail
