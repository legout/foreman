# Host: Paseo

Load the `paseo` skill. It owns the exact tools and parameters. Use the agent-scoped MCP tools if you have them; otherwise use the matching `paseo` CLI commands (see `paseo <cmd> --help`). Paseo allocates worktrees itself, so never hand-place one.

## Place

Call `create_workspace` with:

- `isolation: "worktree"`, `mode: "branch-off"`;
- `branchName: "issue/<n>-<slug>"`, `worktreeSlug: "<n>-<slug>"`, `baseBranch: "origin/main"`;
- the project's `projectId` or `path`.

For a reviewer or verifier, use `mode: "checkout-pr"` with `prNumber`. Record the returned `workspaceId` and `cwd`. Paseo places the worktree under its `worktrees.root` and names the branch exactly as you gave it.

On a remote daemon, paths are the daemon's own. Send the brief inline, because the agent cannot read local files.

## Start

1. Map the profile entry to a Paseo provider: `pi`, `codex`, `opencode`, or `hermes`. For `claude` and `omp`, check `list_providers` first; they are often disabled.
2. Find the model in `list_models` for that provider. Pi model IDs keep their `provider/model` form, so the value is `pi/<provider/model>`.
3. Choose `thinkingOptionId` from that model's listed options. Take the closest listed level at or above the profile level: Pi often lists only `low`, `high`, `max`, in which case `medium` becomes `high` and `xhigh` becomes `max`.
4. Call `create_agent` with:
   - `title: "<role>-<n>"`, `provider`, `workspaceId`;
   - `settings.thinkingOptionId`, plus `settings.modeId` for an edit-capable mode;
   - `labels: { factory: "<repo>", issue: "<n>", role: "<role>" }`;
   - `notifyOnFinish: true`;
   - `initialPrompt`: `Read and execute <brief-path>`, or the brief text itself.

If the user has configured `list_profiles`, those profiles do not replace the factory profile. Use their notes only to learn the right `modeId`.

For read-only roles, pick the provider's plan or read-only mode from `list_providers`/`inspect_provider` (for example opencode `Plan`, codex `Default Permissions`), and state "read-only" in the brief. Pi lists no modes, so the brief alone enforces read-only.

## Follow up, wait, stop

| Verb | Tool (CLI) |
|---|---|
| follow up | `send_agent_prompt { agentId, prompt }` (`paseo send <id> "<msg>"`) |
| wait | the `notifyOnFinish` callback; never poll. Without agent scope, use `paseo wait <id>` per agent |
| status | `paseo inspect <id>` (shows the effective provider, model, and thinking level), `paseo logs <id>` |
| stop | `paseo stop <id>`; after a merge or rejection, `archive_workspace` removes the agent and its worktree, but the branch stays |

A permission request from an agent comes back as a notification. Answer it only when the authority section of `AGENTS.md` grants the action; otherwise, set `needs:owner`.
