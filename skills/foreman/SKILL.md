---
name: foreman
description: "Autonomous software factory on GitHub issues with parallel agent workers on Herdr, Paseo or BB. Use to run the factory backlog as foreman, initialize a repo for it (factory init), turn an approved plan into factory issues, or file deslop/test-diet upkeep issues."
---

# Foreman

Find the case below that matches the request and follow it:

- **Run the factory**: the rest of this file.
- **Initialize a repository**: [init.md](references/init.md).
- **Turn a plan into issues**: [plan-to-issues.md](references/plan-to-issues.md).
- **Upkeep issues** (deslop, test-diet): [upkeep.md](references/upkeep.md).

When you run the factory, you own triage, routing, dispatch, acceptance, and merging. You never implement anything yourself. The project's `AGENTS.md` defines the authority grant, the labels, the commands, and the issue format. Load `agent-guardrails` now.

GitHub is the only state. After a restart or compaction, rebuild everything from `gh issue list`, `gh pr list`, and the host's list of your live workers. Keep no other state files.

## Startup

1. Run `gh auth status`, then pick the host and read its adapter per [dispatch.md](references/dispatch.md). Stop if either fails.
2. Read the active profile from `.foreman/profile` in the repository. If that file is missing, use `mixed`. The profile is `profiles/<name>.json` in this skill's directory, or `.foreman/<name>.json` in the repository.
3. Rebuild state from GitHub.

## Lanes

Pick the cheapest lane that can succeed, and comment the reason in one line.

| Lane | When | Pipeline | Merge gate |
|---|---|---|---|
| quick | Mechanical, about one file, docs, config, or a rename. No new behavior. | `builder-quick` and the existing focused check. | You read the diff, and CI is green. |
| standard | A bounded behavior change in 1–3 modules. | `builder` works test-first. | Diff read, CI green, and every acceptance criterion ticked against evidence. Add a `reviewer` only on a risk trigger. |
| deep | Ambiguous or cross-cutting work: architecture, persistence, migrations, concurrency, performance, or security. Also any issue that already failed in standard. | `tester` writes failing tests, then `builder-deep`, then `reviewer`, at most one fix pass, a delta recheck, then `verifier`. | Reviewer `pass`, verifier pass, CI green. |
| spike | A question to answer before the work can be specified. | A read-only `scout` or `oracle` posts findings, then you write the real issues. | No merge. |

Risk triggers:

- a public CLI or file-format contract;
- persisted data;
- an auth, credential, or untrusted-input boundary;
- a new dependency;
- a diff over about 400 lines.

Escalate one lane at a time, giving a reason each time:

- quick fails → standard;
- standard is still red after two honest attempts → deep;
- deep still has findings after its fix pass → oracle, then `needs:owner`.

## Loop

On each owner instruction or worker notification, reconcile the run within its original scope, including any owner changes.

1. **Triage.** Every new issue without `needs:owner` needs acceptance criteria. If an issue is too large for one PR, split it. Set its lane and any `ui` or `docs` label, and set `status:ready` once nothing blocks it. If the work is unclear, file a spike issue instead.
2. **Dispatch** ready issues whose dependencies are closed and whose **Touches** do not overlap an active issue.
   - Run at most 3 writers and 2 read-only workers at once.
   - Lower both limits when the load average is above twice the core count.
   - Place and start each worker per [dispatch.md](references/dispatch.md) and the host adapter.
   - Then set `status:active` and comment the session name and branch.
3. **Collect or yield.** Read new issue/PR comments for workers that reported. Process each report once; a wake-up message alone is not evidence. If there is no actionable work but workers are still running, yield as the host adapter describes. Otherwise finish the run.
4. **Check.** Read the PR diff and the evidence comment, and tick each acceptance criterion against the evidence. If TDD was required but there is no red/green proof, reject in one line. Then run the lane's next step.
5. **Disposition** each reviewer finding before any repair:
   - reject a finding that fails the guardrails gate;
   - send a small in-scope fix to the same builder: one fix pass, then a delta-only recheck;
   - send anything large or out of scope to a new issue or `needs:owner`.
6. **Merge** when the gate passes and CI is green:
   - `gh pr merge --squash --delete-branch`;
   - close the issue with a one-line evidence comment;
   - stop the issue's workers and release their checkouts with the host's stop verb.
7. **Stuck workers:**
   - `BLOCKED:` comment, host `blocked`, or `error`: read it once, then answer with follow up, or replace the worker;
   - no progress: interrupt it, then one steering follow-up;
   - two failures: escalate the lane.
8. **Owner gates.** Set `needs:owner`, comment the exact question in one line, and keep working on other ready issues.

## Look up

- Host detection, briefs, reports, reviewer brief → [dispatch.md](references/dispatch.md)
- Profiles, roles, and per-role skills → [roles.md](references/roles.md)
