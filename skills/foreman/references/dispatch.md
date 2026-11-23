# Dispatch

The work is the same on every host. Only how you place, start, follow up with, wait for, and stop a worker depends on the host, and the host adapter covers those steps.

## Host

Pick the first host whose check passes, then read only its adapter.

| Host | Detected by | Adapter |
|---|---|---|
| BB | `BB_THREAD_ID` is set | [hosts/bb.md](hosts/bb.md) |
| Paseo | `PASEO_AGENT_ID` is set, or the Paseo MCP tools are available | [hosts/paseo.md](hosts/paseo.md) |
| Herdr | `HC_TERMINAL_ID` is set | [hosts/herdr.md](hosts/herdr.md) |

- If the owner names a host, use that host even when detection would pick another.
- If no check passes, stop and tell the owner that no supported host was found.

Each adapter defines five verbs:

- **place**: give the worker an isolated checkout;
- **start**: launch the worker with the profile's CLI, model, and thinking level;
- **follow up**: send the worker another message;
- **wait**: block until any worker finishes, needs input, or errors;
- **stop**: end the worker.

Every adapter follows the same rules:

- **One writer per isolated checkout.** A tester and then a builder may share one branch, but only one after the other. A reviewer or verifier gets its own read-only checkout at the PR head.
- **Prefer the host's own worktree placement.** Use the host's own worktree placement; do not hand-place worktrees under the host. Before the worker writes anything, check its cwd, branch, and base in a no-write preflight.
- **Start each worker fresh, with a brief.** Never reuse an existing agent, and never use one-shot or print mode.
- **Map the profile entry through the host.** The host's live model list is the source of truth. If the exact model and thinking level are not available, fall back to the next entry in the profile chain, and name the fallback in the issue comment. Never guess an alias.

## Brief

Write each brief to `${XDG_STATE_HOME:-$HOME/.local/state}/factory/<repo>/<n>-<role>.md`, never inside the worktree. If the host's workers cannot read that file (for example, a remote machine), send the brief text inline instead. Fill in every field:

```text
ROLE: <role>   ISSUE: #<n> <url>   LANE: <lane>
WORKTREE: <path or host workspace>  BRANCH: issue/<n>-<slug>  BASE: <sha>
SKILLS: load <skills> before starting.
GOAL: <one line>
ACCEPTANCE CRITERIA: <checklist from the issue>
SCOPE: may edit <files/modules>; must not touch <...>.  NON-GOALS: <...>
VALIDATION: <failing test(s) for AC x,y first | existing check <cmd> | no-new-test: <why>>; focused cmd: <cmd>; nothing broader.
DONE WHEN: <criteria met + evidence>; then follow your role section in AGENTS.md.
```

## Reports

Workers report through GitHub, and then end their turn:

- **done**: the evidence goes in a PR comment;
- **blocked**: the question goes in an issue comment starting with `BLOCKED:`.

The host's completion notification wakes you. When it does, read the newest comments on the issue and PR. Then:

- **To answer a question, or to start a fix pass:** use *follow up* to send the answer or the accepted findings, together with the same VALIDATION line.
- **When there is no comment, or the host reports an error:** read the host's status or log, and handle it as a stuck worker.

## Reviewer brief

Paste the full **Reviewer Dispatch** block from `agent-guardrails` into the reviewer's brief, filled in with:

- the PR's base..head;
- the acceptance criteria;
- the written rules: `AGENTS.md` plus the specs and ADRs it cites;
- the real callers, inputs, and environment.

For a recheck, replace the block's first line with the skill's re-review line, naming the prior head and the fix head.
