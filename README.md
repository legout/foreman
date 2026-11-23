# foreman

foreman is an autonomous software factory for [Pi](https://pi.dev). It takes you from an idea to a spec, then to a plan and GitHub issues. One Pi session, the **foreman**, works through those issues. It runs Pi workers in parallel Herdr-app tabs, sends each issue down a cheap or a thorough lane, and squash-merges a PR when the evidence holds up.

## Setup (once per machine)

```sh
git clone https://github.com/legout/foreman && ./foreman/setup.sh
```

`setup.sh` is safe to re-run. It also updates what it installed:

- **Pi packages:** `pi-intercom`, `pi-subagents`, `skill-diet`, and this package. The package adds the `foreman` skill and the `/to-issues`, `/factory-run` and `/factory-upkeep` commands.
- **Skills:** installed globally with `npx skills add`. Each skill keeps one upstream owner, and `npx skills update -g` refreshes them.
- **Check:** at the end it runs `doctor.sh`, which checks tools, packages, skills and models. Run `./doctor.sh` again at any time.

Before you run it, install `pi`, `hc` (with the Herdr app running), `gh` (authenticated with `gh auth login`), Node.js/`npx` and `git`. You also need model access in Pi for the roles in `skills/foreman/references/roles.md`. If a model is missing, edit that file's model chains.

## Per project

```sh
./foreman/init.sh ~/code/myproject   # writes AGENTS.md and creates the labels; then fill in its TODOs
```

## Workflow

| Step | You run | Skills behind it |
|---|---|---|
| 1. Shape | `/skill:shape-design <idea>` (`grilling` to stress-test it) | shape-design, domain-modeling, planning-contract |
| 2. Plan | `/skill:write-implementation-plan <spec>` | write-implementation-plan, planning-contract |
| 3. Issues | `/to-issues <plan>`: you approve the list, then it files the issues | foreman |
| 4. Build | in a Herdr tab: `pi --name foreman --model claude-code/claude-opus-5-5 --thinking high`, then `/factory-run` | foreman → workers: agent-guardrails, tdd, systematic-debugging, impeccable, documentation-writer, research |
| 5. Upkeep | `/factory-upkeep [deslop\|test-diet]` turns proposals you approve into issues | deslop, test-diet |
| Once | `/skill:project-verification` writes the `verify-*` recipe that the deep-lane verifier uses | project-verification |
| Release | `/skill:make-release`; the factory never releases | make-release |

You drive steps 1–3 and 5, and you approve every spec, plan, issue list and cleanup. The foreman does step 4 without you. It labels any issue that needs a decision `needs:owner` and keeps going with the rest.

## How the factory runs

```
GitHub issues ──▶ foreman (Pi, Herdr tab)
                    │ triage → lane: quick | standard | deep | spike
                    │ hc run --bg  (one tab + worktree per worker)
                    ▼
     builder-quick · builder (TDD) · tester → builder-deep → reviewer → verifier
                    │ intercom ask/send ◀─────────────┘
                    ▼
               PR + evidence comment ──▶ gate ──▶ squash-merge, close issue
```

- Each worker starts with `--no-skills`, plus a `--skill` flag for every skill its role needs (see `references/roles.md`).
- A quick-lane worker therefore loads one skill and does not see your whole library.

## Layout

| Path | Purpose |
|---|---|
| `factory/AGENTS.md` | Project template: authority, labels, shared rules, worker roles |
| `skills/foreman/` | Foreman-only skill: lanes, loop, roles/models, dispatch |
| `prompts/` | `/to-issues`, `/factory-run`, `/factory-upkeep` |
| `setup.sh`, `doctor.sh`, `init.sh` | Machine setup, health check, per-project init |
