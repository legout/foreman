# foreman

Foreman turns GitHub issues into reviewed pull requests. One agent session triages the backlog, dispatches workers in isolated worktrees, and squash-merges only when the evidence and CI gates pass. GitHub issues, PRs, and comments are the source of truth; there’s no separate job database.

Use **Herdr**, **Paseo**, or **BB** as the worker host. Foreman and its workers can use different agent CLIs: Pi, Oh My Pi, Claude Code, Codex, OpenCode, or Hermes, depending on the host.

## Get started

### 1. Install Foreman

You need Git, Node.js 20+ with `npx`, an authenticated `gh` (`gh auth login`), a running worker host, and your agent CLI. For Pi, run:

```sh
curl -fsSL https://raw.githubusercontent.com/legout/foreman/main/install.sh | bash
```

The installer clones or updates `~/.local/share/foreman`, installs the skills and Pi prompt commands, and runs `doctor.sh`. To install for additional agents, append `-s -- --agents pi,claude-code,codex` after `bash`. To inspect the installer first, clone the repo and run `./setup.sh` from the checkout instead. Run the same command again to update.

### 2. Initialise a GitHub project

```sh
~/.local/share/foreman/init.sh ~/code/myproject mixed
```

Use the [preset](#choose-or-customise-models) that matches your subscriptions as the last argument. `init.sh`:

- creates the GitHub labels;
- stores the preset in `.foreman/profile` (a re-run without a preset keeps the current one);
- writes `AGENTS.md`, linked as `CLAUDE.md`, with the setup, test, and CI commands it detects for npm, pnpm, bun, uv, pip, cargo, go, and Makefile. Anything it can’t detect stays `TODO`;
- leaves an existing `AGENTS.md` or `CLAUDE.md` untouched and writes the [factory template](factory/AGENTS.md) to `.foreman/AGENTS.template.md` instead.

Then run `/factory-init` in Pi (or ask your agent to **factory init**). It fills the `TODO`s or merges the template, and shows you the result before writing. Review the authority section before dispatch: it defines what Foreman may do without asking.

### 3. Start work

Open an agent in your project inside Herdr, Paseo, or BB. This session is the Foreman; a mid-tier model such as Sonnet or Terra at `high` is enough. Use a Pi command below, or ask another CLI to do the same thing with the `foreman` skill.

| Starting point | What to run |
|---|---|
| A small, clear goal within the project’s authority | `/factory-job "Document the existing config options and verify the examples"` creates an epic with up to five tasks, including final verification, and starts dispatch. Work that needs a spec or architectural decision goes to `shape-design` instead. |
| An approved plan from `write-implementation-plan` | `/to-issues path/to/plan.md` previews the tasks for approval, then creates an epic and sub-issues with native GitHub **blocked by** edges. Run `/factory-run` afterward. |
| Issues already on GitHub | `/factory-run 42 43` runs the selected issues; `/factory-run` without arguments considers the open backlog. For manual issues, follow the [issue template](factory/AGENTS.md): goal, acceptance criteria, files touched, source, and dependencies. |
| Cleanup candidates | `/factory-upkeep deslop` or `/factory-upkeep test-diet` proposes issues for owner approval before filing. |

## What happens during a run

1. **Baseline:** Foreman checks default-branch CI before dispatch. A red baseline goes on the epic; Foreman starts with a baseline fix or asks the owner. Only the same pre-existing check and failure signature can qualify for an exemption, and branch protection still applies.
2. **Dispatch:** Foreman picks a `quick`, `standard`, `deep`, or read-only `spike` lane. It runs independent tasks in parallel, but won’t start a task with open prerequisites or overlapping write scope. Native dependency edges take precedence over legacy `Depends on #n` text.
3. **Accept:** Workers report evidence on GitHub. Foreman checks it against each task’s criteria before merging, with independent review and verification where the lane calls for it. When idle, it yields to worker notifications on Herdr, BB, and agent-scoped Paseo, so you can send more instructions.
4. **Verify the goal:** Where the epic has a final verification issue, a verifier checks the integrated result. If it fails, Foreman can file the missing in-scope work and retry for up to two rounds, then marks `needs:owner`. Out-of-scope decisions go to the owner immediately.

Your part during a run: answer issues labelled `needs:owner`. You can message the Foreman session at any time; it picks up new instructions between worker reports.

Foreman does not implement changes itself or release or deploy them. For repeatable project-specific verification, use `project-verification` to write the `verify-*` recipe your verifier should follow.

## Choose or customise models

Browse [the preset JSON files](skills/foreman/profiles). Each worker role has an ordered fallback list of model IDs and thinking levels. Choose the Foreman session’s own model when you launch it; the profile does not switch an already running session.

| Preset | Use when you have |
|---|---|
| `mixed` | Claude, ChatGPT, GLM, and Kimi access (default) |
| `chatgpt` | A ChatGPT subscription |
| `claude` | A Claude subscription |
| `open-weights` | Direct open-weight providers or CommandCode |
| `opencode-go` | An OpenCode Go subscription; set `OPENCODE_API_KEY` for Pi on the worker host |

To use a custom profile, initialise with the closest preset, then run this **from the project root**:

```sh
cp ~/.local/share/foreman/skills/foreman/profiles/mixed.json .foreman/my-team.json
printf '%s\n' my-team > .foreman/profile
```

Edit `.foreman/my-team.json` to match the models available on your host (`pi --list-models` for Pi). Keep reviewer models distinct from builders. A top-level `"cli"` field (`claude`, `codex`, `omp`, `opencode`, or `hermes`) runs the workers with another CLI; every shipped profile uses `pi`. `init.sh` accepts built-in preset names only; the running skill also loads project-local profiles. To check that Pi can reach every model of a preset, run `FOREMAN_PROFILE=<preset> ~/.local/share/foreman/doctor.sh`.

See the [Foreman skill](skills/foreman/SKILL.md) for lane gates, [host adapters](skills/foreman/references/hosts) for launch details, and the [factory template](factory/AGENTS.md) for permissions and worker rules.
