# Dispatch

## Worktree

A writer gets a new branch from `origin/main`:

```sh
WT=${XDG_STATE_HOME:-$HOME/.local/state}/worktrees/<repo>/<n>-<slug>
git fetch origin && git worktree add -b issue/<n>-<slug> "$WT" origin/main
```

- Give each writer its own worktree; never put two writers in one.
- A tester and a builder on the same issue share one branch, one after the other: the builder starts only after the tester has reported.
- Reviewers and verifiers each get a detached worktree at the PR head: `git worktree add --detach "$WT-r" <head-sha>`.

## Launch

Start the worker in a new tab of your space. Pass the command as separate arguments with absolute paths: a quoted command string runs under `sh` without your `PATH`.

```sh
hc run --bg --json --name <role>-<n> --cwd "$WT" --label herdr.space=<space> \
  /home/volker/.pi/agent/bin/pi --name <role>-<n> --model <provider/model> --thinking <level> \
  --no-skills --skill ~/.agents/skills/agent-guardrails [--skill ...] [--exclude-tools edit,write]
hc wait <role>-<n>
hc send <role>-<n> "Read and execute <brief-path>"
```

- Wait until the worker is idle before you send the brief: a prompt passed at launch can be dropped.
- After sending, run `hc read <role>-<n>` once to confirm it started the task.
- If the JSON from `hc run` reports a failed send, read the terminal before you resend anything.

## Brief

Write each brief to `${XDG_STATE_HOME:-$HOME/.local/state}/factory/<repo>/<n>-<role>.md`. Never put it inside the worktree. A fresh session knows only what the brief says, so fill in every field:

```text
ROLE: <role>   ISSUE: #<n> <url>   LANE: <lane>
WORKTREE: <path>  BRANCH: issue/<n>-<slug>  BASE: <sha>
GOAL: <one line>
ACCEPTANCE CRITERIA: <checklist copied from the issue>
SCOPE: may edit <files/modules>; must not touch <...>.  NON-GOALS: <...>
VALIDATION: <failing test(s) for AC x,y first | existing check <cmd> | no-new-test: <why>>; focused cmd: <cmd>; nothing broader.
DONE WHEN: <criteria met + evidence>; then follow your role section in AGENTS.md.
QUESTIONS: intercom ask "foreman"; keep doing other safe work meanwhile.
```

For a fix pass, send the accepted findings and the same VALIDATION line to the worker that is already running.

## Reviewer brief

Paste the whole **Reviewer Dispatch** block from `agent-guardrails` into the brief and fill in:

- `<base>..<head>`: the PR's base and head;
- the acceptance criteria;
- the written rules: `AGENTS.md` plus the cited specs and ADRs;
- the real callers, inputs, and environment.

Do not just link the block.

For a recheck, replace its first line with the skill's re-review line and name the prior head and the fix head.
