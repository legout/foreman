# foreman

foreman is a small autonomous software factory for [Pi](https://pi.dev). One Pi session, the foreman, works a project's GitHub issues. It starts Pi workers in parallel Herdr-app tabs, sends each issue down a cheap or a thorough lane, and squash-merges the work once a gate passes.

```
GitHub issues ──▶ foreman (Pi, Herdr tab)
                    │ triage → lane: quick | standard | deep | spike
                    │ hc run --bg  (one tab per worker, own worktree)
                    ▼
     builder-quick · builder (TDD) · tester → builder-deep → reviewer → verifier
                    │ intercom ask/send ◀─────────────┘
                    ▼
               PR + evidence comment ──▶ gate ──▶ squash-merge, close issue
```

## Contents

| Path | Purpose |
|---|---|
| `factory/AGENTS.md` | Project template that every session reads: authority, labels, shared rules, worker roles. |
| `skills/foreman/` | The foreman's skill: lanes, loop, roles and models, dispatch recipes. Workers never load it. |
| `install.sh` | Installs the catalog skills globally and links `skills/foreman`. |
| `init.sh` | Writes `AGENTS.md` into a repo and creates the labels. |

## Use

```sh
./install.sh                      # once per machine
./init.sh ~/coding/myproject      # once per project, then fill in the AGENTS.md TODOs
# in a Herdr-app tab, inside the project:
pi --name foreman --model claude-code/claude-opus-5-5 --thinking high
> /skill:foreman  run the backlog
```

## Requirements

You need:

- `pi`, with these packages installed:
  - `pi-intercom`
  - `pi-subagents`
- `hc` (herdr-core), with the Herdr app running;
- `gh`, already authenticated;
- `npx`.

## Skills

Workers start with `--no-skills` plus an explicit `--skill` list for their role (see `skills/foreman/references/roles.md`). Each worker therefore loads only the skills its role needs.

| Skill | Source | Used by |
|---|---|---|
| agent-guardrails | legout/skills | all roles |
| tdd | mattpocock/skills | builder, builder-deep, builder-ui, tester |
| systematic-debugging | legout/skills | builder, builder-deep |
| impeccable | pbakaus/impeccable | builder-ui |
| documentation-writer | legout/skills | writer |
| research | legout/skills | scout |
| foreman | this repo | foreman only |
