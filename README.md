# foreman

foreman is an autonomous software factory for coding agents. You plan the work as GitHub issues. One **foreman** session works through those issues: it starts agent workers in parallel Herdr-app tabs, sends each issue down a cheap or a thorough lane, and squash-merges a PR once the evidence holds up.

It runs with Pi, Oh My Pi, Claude Code, Codex, OpenCode and Hermes, on three worker hosts:

- Herdr (`hc`) tabs;
- Paseo agents;
- BB threads.

The foreman and the workers can each use a different CLI. The foreman picks the host it detects in its environment.

## Setup (once per machine)

```sh
curl -fsSL https://raw.githubusercontent.com/legout/foreman/main/install.sh | bash
curl -fsSL https://raw.githubusercontent.com/legout/foreman/main/install.sh | bash -s -- --agents pi,claude-code,codex
```

`install.sh` clones foreman into `~/.local/share/foreman`, or pulls if a clone is already there, then runs `setup.sh` with your arguments. To check the code before you run it, clone manually instead: `git clone https://github.com/legout/foreman && ./foreman/setup.sh`.

You need these installed first:

- one worker host: `hc` (herdr-core, with the Herdr app running), the Paseo daemon, or BB;
- `gh`, already authenticated;
- Node.js/`npx` and `git`;
- at least one agent CLI.

`setup.sh` installs the `foreman` skill and every skill it relies on into each agent you listed. For Pi it also adds the slash commands. It finishes by running `doctor.sh`. Re-running it updates everything.

## Per project

```sh
~/.local/share/foreman/init.sh ~/code/myproject [profile]   # profile: mixed | chatgpt | claude | open-weights
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
| 4. Build | In a Herdr tab, a Paseo agent, or a BB thread: "run the factory" (`/factory-run`) | foreman, plus for workers: agent-guardrails, tdd, systematic-debugging, impeccable, documentation-writer, research |
| 5. Upkeep | "factory upkeep deslop" (`/factory-upkeep`). Proposals you approve become issues. | deslop, test-diet |
| Once | "project-verification": writes the `verify-*` recipe that the deep-lane verifier follows | project-verification |
| Release | "make-release". The factory never releases. | make-release |

You own steps 1–3 and 5, and you approve every spec, plan, issue list and cleanup. The foreman runs step 4 without you. When an issue needs your decision, it labels it `needs:owner` and moves on to other work.

## How the factory runs

```
GitHub issues ──▶ foreman (any CLI, on Herdr | Paseo | BB)
                    │ triage → lane: quick | standard | deep | spike
                    │ host: place (isolated worktree) + start (CLI/model from profile)
                    ▼
     builder-quick · builder (TDD) · tester → builder-deep → reviewer → verifier
                    │ PR / issue comment, end turn ──▶ host notifies foreman
                    ▼
               evidence ──▶ gate ──▶ squash-merge, close issue
```

Workers report through GitHub comments and then end their turn. The host's completion notification wakes the foreman, so no messaging channel is needed. Each host adapter in `skills/foreman/references/hosts/` maps five verbs: place, start, follow up, wait and stop. Pi and Oh My Pi workers on Herdr are also restricted to the skills their role needs.

T3 Code is not supported: its child tasks share the parent's checkout, so parallel writers would collide.

## Layout

| Path | Purpose |
|---|---|
| `skills/foreman/` | The skill: the run loop, plus references for dispatch, roles, init, plan-to-issues and upkeep, the host adapters (`references/hosts/`) and the profiles |
| `factory/AGENTS.md` | Project template: authority, labels, shared rules and worker roles |
| `prompts/` | Pi slash commands; each is a thin wrapper around the skill |
| `install.sh`, `setup.sh`, `doctor.sh`, `init.sh` | curl installer, machine setup, health check, per-project init |
