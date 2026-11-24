---
name: foreman
description: "Autonomous software factory on GitHub issues with parallel agent workers on Herdr, Paseo or BB. Run the backlog, start a bounded factory job, initialize a repo, turn an approved plan into issues, or file upkeep issues."
---

# Foreman

- **Start a bounded job**: [job.md](references/job.md).
- **Initialize a repository**: [init.md](references/init.md).
- **Turn a plan into issues**: [plan-to-issues.md](references/plan-to-issues.md).
- **Upkeep issues** (deslop, test-diet): [upkeep.md](references/upkeep.md).

When you run the factory, you own triage, routing, dispatch, acceptance, and merging. You never implement anything yourself. The project's `AGENTS.md` defines the authority grant, the labels, the commands, and the issue format. Load `agent-guardrails` now.

GitHub is the only state. After a restart or compaction, rebuild everything from `gh issue list`, `gh pr list`, and the host's list of your live workers. Keep no other state files.

## Startup

1. Run `gh auth status`, then pick the host and read its adapter per [dispatch.md](references/dispatch.md). Stop if either fails.
2. Read the active profile from `.foreman/profile` in the repository. If that file is missing, use `mixed`. The profile is `profiles/<name>.json` in this skill's directory, or `.foreman/<name>.json` in the repository.
3. Rebuild state from GitHub. Read native blocked-by edges per [plan-to-issues.md](references/plan-to-issues.md); use body text for legacy issues.
4. Before dispatch, establish the default-branch CI baseline for the epic per [baseline.md](references/baseline.md).

## Lanes

Pick the cheapest lane that can succeed, and comment the reason in one line.

| Lane | When | Pipeline | Merge gate |
|---|---|---|---|
| quick | Mechanical, about one file; no new behavior. | `builder-quick` and the existing focused check. | Read the diff. |
| standard | Bounded behavior change in 1–3 modules. | `builder` test-first; `reviewer` on risk triggers. | Read the diff and check every criterion against evidence. |
| deep | Ambiguous or cross-cutting: architecture, persistence, migrations, concurrency, performance, security, or failed standard work. | `tester` → `builder-deep` → `reviewer` → at most one fix and delta recheck → `verifier`. | Reviewer and verifier pass. |
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

1. **Triage.** Never dispatch the epic itself. For each task without `needs:owner`, require checkable criteria, split anything larger than one PR, and set lane and `ui`/`docs` labels. Set `status:ready` only when unblocked. File a spike for unclear work.
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
6. **Merge** when the lane and CI gates pass (only exact baseline exemptions):
   - `gh pr merge --squash --delete-branch`;
   - close the issue with a one-line evidence comment;
   - stop the issue's workers and release their checkouts with the host's stop verb.
7. **Stuck workers:**
   - `BLOCKED:` comment, host `blocked`, or `error`: read it once, then answer with follow up, or replace the worker;
   - no progress: interrupt it, then one steering follow-up;
   - two failures: escalate the lane.
8. **Owner gates.** Set `needs:owner`, comment the exact question in one line, and keep working on other ready issues.

9. **Verify the epic goal.** Dispatch the final issue as verifier-only at the integrated default-branch SHA (no PR or builder; use an isolated checkout). Close it and the epic only on pass. On failure, record a numbered extend round on the epic, file in-scope gaps as sub-issues, and block verification on those issues using both edge forms. Retry after they close. At most two rounds; then set `needs:owner`. Escalate out-of-scope gaps immediately.

## Look up

- Host detection, briefs, reports, reviewer brief → [dispatch.md](references/dispatch.md)
- Profiles, roles, and per-role skills → [roles.md](references/roles.md)
