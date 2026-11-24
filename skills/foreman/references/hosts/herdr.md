# Host: Herdr (herdr-core `hc`)

For exact syntax, read `hc --skill` and `hc <cmd> --help`. Herdr has no worktree allocator, so you create the worktrees.

## Place

```sh
WT=${XDG_STATE_HOME:-$HOME/.local/state}/worktrees/<repo>/<n>-<slug>
git fetch origin && git worktree add -b issue/<n>-<slug> "$WT" origin/main
git worktree add --detach "$WT-r" <head-sha>   # reviewer or verifier
```

## Start

Start each worker in a new tab of your space with `hc run`.

- Launch through your login shell: `<login-shell> -lic 'exec <cli> <cli-args>'`, where `<login-shell>` is `$SHELL` as an absolute path. A bare quoted string runs under `sh` without your `PATH`. An absolute CLI path also fails for Node-based CLIs such as `pi`, because their `env node` shebang still needs `PATH`.
- `<m>` is the model from the profile and `<t>` its thinking level.
- Add to every worker brief: **After posting your GitHub report (including `BLOCKED:`), run `hc send <foreman-terminal> "Factory #<n> <role>: report posted"` before ending your turn.** Fill in the foreman's `$HC_TERMINAL_ID`, the issue, and the role. Send only the wake-up, not the evidence.

```sh
hc run --bg --json --name <role>-<n> --cwd "$WT" --label herdr.space=<space> "$SHELL" -lic 'exec <cli> <cli-args>'
hc wait <role>-<n>
hc send <role>-<n> "Read and execute <brief-path>"
```

| CLI | Args | Skills for the role | Read-only roles add |
|---|---|---|---|
| `pi` | `--name <role>-<n> --model <m> --thinking <t>` | `--no-skills --skill ~/.agents/skills/<s>` per skill | `--exclude-tools edit,write` |
| `omp` | `--model <m> --thinking <t>` | `--skills <s1>,<s2>` | `--tools read,grep,find,bash` |
| `claude` | `--model <m> --effort <t> --name <role>-<n> --permission-mode acceptEdits` | none; the brief names them | `--disallowed-tools Edit,Write` |
| `codex` | `-m <m> -c model_reasoning_effort=<t> -a never -s workspace-write` | none; the brief names them | `-s read-only` |
| `opencode` | `-m <m>` | none; the brief names them | `--agent plan` |
| `hermes` | `chat -m <m> --reasoning <t> -s <s1> -s <s2> --yolo` | `-s` per skill | none; the brief says read-only |

- **Thinking for `claude` and `codex`:** use `xhigh` for both `max` and `xhigh`.
- **First launch of a CLI:** start it once in a scratch tab and check that it comes up, then kill that tab.
- **Sending the brief:** send it only after `hc wait` returns, because a prompt sent during launch can be dropped. If `first_message.sent` is false, run `hc read` before you resend anything. After a successful send, run `hc read` once.

## Follow up, yield, stop

| Verb | Command |
|---|---|
| follow up | `hc send <role>-<n> "<message>"` |
| yield | End your turn. The worker's `hc send` wakes you. Leave Herdr notes enabled and don't use `--no-notify`, so the host can also surface blocked, errored, or exited children that cannot report. |
| status | `hc get <role>-<n>`, `hc read --lines 100 <role>-<n>` |
| stop | `hc interrupt` stops the current turn; `hc kill` then `hc rm` ends the worker; then `git worktree remove "$WT"` |
