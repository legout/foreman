# Host: BB

Load the `bb-cli` skill for command syntax. `bb guide threads` and `bb <cmd> --help` are the authority on flags.

- BB environments own their worktrees, so never hand-place a worktree.
- Pass `--json` to every command, and parse only stdout.

## Place and start

Each worker is a child thread that `bb thread spawn` creates in a fresh worktree environment. Feed the brief through stdin with `--prompt-file -`:

```sh
bb thread spawn --json --parent-self --project <project-id> --title "<role>-<n>" \
  --new-environment worktree --base-branch origin/main \
  --provider <provider> --model <model> --reasoning-level <t> \
  --permission-mode full --prompt-file - < <brief-path>
```

- **`<provider>`:** use `pi` for Pi entries. `bb provider list --json` shows the others: `codex`, `acp-omp`, `acp-opencode`, `acp-hermes-agent`.
- **`<model>` and `<t>`:** must come from `bb provider models <provider> --json`, which run on the machine that executes the thread.
- **Unsupported model or level:** if the exact pair is missing, fall back along the profile's chain.
- **Permission mode:** `pi` accepts only `full`. Other providers may take `accept-edits`.
- **Project:** resolve `<project-id>` with `bb project list --json`. Create the project with `bb project create --root <repo>` only if the authority section in `AGENTS.md` allows it.
- **Record:** keep the returned thread `id`. The environment, its `path`, and its `branchName` appear under `environment` in the output of `bb thread show <id> --json`.

**Branch.** The worker's first step is `git switch -c issue/<n>-<slug>` inside its environment, before any write. BB names the environment branch itself, so this keeps the factory's branch names.

**Reviewer or verifier.** Spawn it without `--new-environment`, using `--environment <path>` for a detached checkout at the PR head. Create that checkout yourself, outside any writer's environment:

```sh
git worktree add --detach "${XDG_STATE_HOME:-$HOME/.local/state}/worktrees/<repo>/<n>-r" <head-sha>
```

Never point a reviewer or verifier at a writer's environment.

## Follow up, yield, stop

| Verb | Command |
|---|---|
| follow up | `bb thread tell <id> --mode auto --message-file -` (`auto` steers a live turn, or else starts a new one; plain `steer` cannot reach an idle worker) |
| yield | End your turn and resume on parent notifications from child threads. |
| status | `bb thread show <id> --json`, `bb thread output <id>`, `bb thread log <id>` |
| stop | `bb thread stop <id>` |

- A `queued` send is not a failure, so do not resend it.
- After a merge or rejection, run `bb thread archive <id>`, then `bb environment delete <env-id>`. The delete removes the worktree, but the branch stays.
