# foreman

foreman is an autonomous software factory for coding agents. You plan the work as GitHub issues. One **foreman** session works through those issues: it starts agent workers in parallel Herdr-app tabs, sends each issue down a cheap or a thorough lane, and squash-merges a PR once the evidence holds up.

It runs with Pi, Oh My Pi, Claude Code, Codex, OpenCode and Hermes. The foreman and the workers can each use a different one of these CLIs.

## Setup (once per machine)

```sh
git clone https://github.com/legout/foreman
./foreman/setup.sh                                   # Pi only
./foreman/setup.sh --agents pi,claude-code,codex     # or any npx-skills agent ids
```

You need these installed first:

- `hc` (herdr-core), with the Herdr app running;
- `gh`, already authenticated;
- Node.js/`npx` and `git`;
- at least one agent CLI.

`setup.sh` installs the `foreman` skill and every skill it relies on into each agent you listed. For Pi it also adds the slash commands. It finishes by running `doctor.sh`. Re-running it updates everything.

## Per project

```sh
./foreman/init.sh ~/code/myproject [profile]   # profile: mixed | chatgpt | claude | open-weights
```

`init.sh` does the following:

- detects your repo and your setup, test and CI commands (npm/pnpm/bun, uv/pip, cargo, go, Makefile);
- writes `AGENTS.md` from those values, plus a `CLAUDE.md` link to it;
- creates the labels;
- stores the profile name in `.foreman/profile`.

Anything it cannot detect stays `TODO`. Ask your agent to run **"factory init"** (in Pi: `/factory-init`): it fills in the TODOs and shows them to you before writing.

## Profiles

A profile maps each role (quick/standard/deep builder, UI builder, writer, tester, reviewer, verifier, scout, oracle) to a fallback chain of models.

| Profile | For |
|---|---|
| `mixed` | Claude, ChatGPT, GLM and Kimi. Reviewers use a different model family than the builders. |
| `chatgpt` | A ChatGPT subscription only |
| `claude` | A Claude subscription only |
| `open-weights` | GLM, Kimi, DeepSeek and MiniMax, through Z.ai, Kimi, CommandCode or OpenCode Go |

To customize a profile, copy it from `skills/foreman/profiles/` to `.foreman/<name>.json` in your project and edit it there. A `"cli"` field switches workers to `claude`, `codex`, `opencode`, `omp` or `hermes`. `FOREMAN_PROFILE=<name> ./doctor.sh` checks that Pi can use every model in a profile.

## Workflow

| Step | Ask your agent (Pi command) | Skills |
|---|---|---|
| 1. Shape | "shape-design …" | shape-design, grilling, domain-modeling, planning-contract |
| 2. Plan | "write-implementation-plan …" | write-implementation-plan, planning-contract |
| 3. Issues | "factory: plan to issues `<plan>`" (`/to-issues`). Each plan task becomes one issue, and its risk class sets the lane. You approve the list first. | foreman |
| 4. Build | In a Herdr tab: "run the factory" (`/factory-run`) | foreman, plus for workers: agent-guardrails, tdd, systematic-debugging, impeccable, documentation-writer, research |
| 5. Upkeep | "factory upkeep deslop" (`/factory-upkeep`). Proposals you approve become issues. | deslop, test-diet |
| Once | "project-verification": writes the `verify-*` recipe that the deep-lane verifier follows | project-verification |
| Release | "make-release". The factory never releases. | make-release |

You own steps 1–3 and 5, and you approve every spec, plan, issue list and cleanup. The foreman runs step 4 without you. When an issue needs your decision, it labels it `needs:owner` and moves on to other work.

## How the factory runs

```
GitHub issues ──▶ foreman (any CLI, Herdr tab)
                    │ triage → lane: quick | standard | deep | spike
                    │ hc run --bg  (one tab + worktree per worker, CLI/model from the profile)
                    ▼
     builder-quick · builder (TDD) · tester → builder-deep → reviewer → verifier
                    │ hc send <foreman> ◀──────────────┘
                    ▼
               PR + evidence comment ──▶ gate ──▶ squash-merge, close issue
```

`hc` carries all messages between the foreman and its workers, so the setup works with every CLI. When a worker is Pi or Oh My Pi, the foreman also limits it to the skills its role needs.

## Layout

| Path | Purpose |
|---|---|
| `skills/foreman/` | The skill: the run loop, plus references for dispatch, roles, init, plan-to-issues and upkeep, and the profiles |
| `factory/AGENTS.md` | Project template: authority, labels, shared rules and worker roles |
| `prompts/` | Pi slash commands; each is a thin wrapper around the skill |
| `setup.sh`, `doctor.sh`, `init.sh` | Machine setup, health check, per-project init |
