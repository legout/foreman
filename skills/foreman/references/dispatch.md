# Dispatch

## Worktree

```sh
WT=${XDG_STATE_HOME:-$HOME/.local/state}/worktrees/<repo>/<n>-<slug>
git fetch origin && git worktree add -b issue/<n>-<slug> "$WT" origin/main
```

- **Writers:** one writer per worktree. A tester and then a builder may share one branch, but only one after the other.
- **Reviewers and verifiers:** create a detached worktree at the PR head with `git worktree add --detach "$WT-r" <head-sha>`.

## Launch

Start every worker in a new tab of your space as an interactive agent, never in one-shot print mode.

- Pass the command as separate argv arguments, using the absolute path from `command -v <cli>`. A single quoted string runs under `sh` without your `PATH`.
- Build `<cli-args>` from the table below. `<m>` is the profile model, `<t>` is its thinking level, and `<skills>` is the role's skill list.

```sh
hc run --bg --json --name <role>-<n> --cwd "$WT" --label herdr.space=<space> <abs-cli-path> <cli-args>
hc wait <role>-<n>
hc send <role>-<n> "Read and execute <brief-path>. Report with: hc send $HC_TERMINAL_ID '<message>'"
```

| CLI | Args | Skills scoped to the role | Read-only roles add |
|---|---|---|---|
| `pi` | `--name <role>-<n> --model <m> --thinking <t>` | `--no-skills --skill ~/.agents/skills/<s>` for each skill | `--exclude-tools edit,write` |
| `omp` | `--model <m> --thinking <t>` | `--skills <s1>,<s2>` | `--tools read,grep,find,bash` |
| `claude` | `--model <m> --effort <t> --name <role>-<n> --permission-mode acceptEdits` | none; the brief names the skills to load | `--disallowed-tools Edit,Write` |
| `codex` | `-m <m> -c model_reasoning_effort=<t> -a never -s workspace-write` | none; the brief names the skills | `-s read-only` instead of `workspace-write` |
| `opencode` | `-m <m>` | none; the brief names the skills | `--agent plan` |
| `hermes` | `chat -m <m> --reasoning <t> -s <s1> -s <s2> --yolo` | `-s` per skill | none; the brief says read-only |

- **`claude` and `codex` thinking levels:** map `max` and `xhigh` to `xhigh`, and `low`, `medium`, `high` to themselves.
- **Before the first dispatch with a new CLI or model:** check that it starts in a scratch tab, then kill that tab.
- **Sending the brief:** wait until the worker is idle before you send it, because a prompt sent during launch can be dropped. If `first_message.sent` is false, run `hc read` before you resend anything.
- **After sending:** run `hc read` once to confirm the worker picked up the task.

## Brief

Write each brief to `${XDG_STATE_HOME:-$HOME/.local/state}/factory/<repo>/<n>-<role>.md`, never inside the worktree. Fill in every field:

```text
ROLE: <role>   ISSUE: #<n> <url>   LANE: <lane>   PARENT: <your $HC_TERMINAL_ID>
WORKTREE: <path>  BRANCH: issue/<n>-<slug>  BASE: <sha>
SKILLS: load <skills> before starting.
GOAL: <one line>
ACCEPTANCE CRITERIA: <checklist from the issue>
SCOPE: may edit <files/modules>; must not touch <...>.  NON-GOALS: <...>
VALIDATION: <failing test(s) for AC x,y first | existing check <cmd> | no-new-test: <why>>; focused cmd: <cmd>; nothing broader.
DONE WHEN: <criteria met + evidence>; then follow your role section in AGENTS.md.
```

For a fix pass, send the accepted findings and the same VALIDATION line to the running worker.

## Reviewer brief

Paste the full **Reviewer Dispatch** block from `agent-guardrails` into the brief, filled in with:

- the PR's base..head;
- the acceptance criteria;
- the written rules: `AGENTS.md` plus the specs and ADRs it cites;
- the real callers, inputs, and environment.

For a recheck, replace the block's first line with the skill's re-review line, naming the prior head and the fix head.
