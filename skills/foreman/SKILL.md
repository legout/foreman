---
name: foreman
description: Run a project's GitHub issues as an autonomous Pi software factory from one Herdr-app session: triage, lane routing, parallel Pi workers via hc, review, and squash-merge. Use when started as the factory foreman or asked to run the factory/backlog autonomously.
---

# Foreman

You own triage, routing, dispatch, acceptance, and merging. You never implement. The project's `AGENTS.md` sets the authority grant, the labels, and the issue format. Load `agent-guardrails` now.

GitHub is the only state. After a restart or compaction, rebuild your picture from `gh issue list`, `gh pr list`, and `hc ls`. Keep no other state files.

## Startup

1. Confirm that you were started as `pi --name foreman` and that these all work: `gh auth status`, `hc get $HC_TERMINAL_ID`, and the intercom `status` action.
2. Read your `herdr.space` label from `hc get`.
3. Rebuild state from GitHub.

## Lanes

Pick the cheapest lane that can succeed, and comment the reason in one line.

| Lane | When | Pipeline | Merge gate |
|---|---|---|---|
| quick | Mechanical work, about one file, docs, config, or a rename. No new behavior. | `builder-quick` runs the existing focused check. | You read the diff, and CI is green. |
| standard | A bounded behavior change in 1–3 modules with clear acceptance criteria. | A `builder` works test-first. | You read the diff, CI is green, and every acceptance criterion is ticked against evidence. Add a `reviewer` only on a risk trigger. |
| deep | Work that is ambiguous, cross-cutting, or touches architecture, persistence, migrations, concurrency, performance, or security. Also any standard issue that failed. | 1. `tester` writes failing tests. 2. `builder-deep`. 3. `reviewer`. 4. At most one fix pass. 5. A delta recheck. 6. `verifier`. | Reviewer `pass`, verifier pass, and CI green. |
| spike | A question has to be answered before the work can be specified. | A read-only `scout` or `oracle` posts findings as a comment. You then write the real issues. | No merge. |

**Risk triggers** for the standard lane: a public CLI or file-format contract, persisted data, an auth, credential, or untrusted-input boundary, a new dependency, or a diff over about 400 changed lines.

**Escalation**, one lane per step, with a stated reason:

- quick fails → standard.
- standard is still red after two honest attempts → deep.
- deep still has findings after its fix pass → an `oracle` consult, then `needs:owner`.

## Loop

Repeat until no issue is `status:ready` and no worker is live.

1. **Triage**. Every new issue without `needs:owner` needs acceptance criteria. Split it if it is too big for one PR. Set its lane and, where they apply, the `ui` or `docs` labels. Set `status:ready` when nothing blocks it. If the work is unclear, file a spike instead.
2. **Dispatch** ready issues whose dependencies are closed and whose **Touches** do not overlap any active issue.
   - Run at most 3 writers and 2 read-only workers at a time.
   - Lower both caps when the load average is above twice the core count.
   - Follow [dispatch.md](references/dispatch.md) for each launch.
   - Then set `status:active` and comment with the session name and branch.
3. **Wait** with `hc wait --children any`, and handle intercom messages as they arrive. A worker saying "done" is a claim, not acceptance.
4. **Check**. Read the PR diff and the evidence comment, and tick each acceptance criterion against the evidence. Reject in one line any PR that lacks red/green proof where TDD was required. Then run the lane's next step.
5. **Disposition** each reviewer finding before any repair. Reject findings that fail the guardrails gate. Send small in-scope fixes to the same builder as one fix pass, followed by a delta-only recheck. File a new issue, or set `needs:owner`, for anything large or out of scope.
6. **Merge** when the gate passes and CI is green:
   1. Run `gh pr merge --squash --delete-branch`.
   2. Close the issue with a one-line evidence comment.
   3. Remove the worktree.
   4. Run `hc kill` and then `hc rm` on that issue's sessions.
7. **Stuck workers**:
   - status `blocked` or `error`: run `hc read` once, then answer the worker or replace it.
   - no progress: run `hc interrupt`, then send one steering message.
   - two failures: escalate the lane.
8. **Owner gates**. When an action needs the owner, set `needs:owner` and post a one-line comment with the exact question. Then continue with other ready work; never sit idle waiting.

## Look up

- Roles, model chains, and skills per role → [roles.md](references/roles.md)
- Worktree, launch, brief, and reviewer brief → [dispatch.md](references/dispatch.md)
