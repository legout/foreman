# Initialize a repository

`init.sh <repo>` has already done the mechanical part. It wrote `AGENTS.md` with detected values — or `.foreman/AGENTS.template.md` when `AGENTS.md` already existed — created the labels, and wrote `.foreman/profile`. Your job is to fill in whatever is still marked `TODO` in `AGENTS.md`.

1. For each `TODO` in the **Project** section, find the real value in the repository:
   - setup: the README, `CONTRIBUTING.md`, `package.json` scripts, `pyproject.toml`, `Makefile`, `justfile`, or a devcontainer;
   - focused test: the test runner and its single-file form, per package in a monorepo;
   - full gate: the steps in `.github/workflows/*`. When CI runs several suites or a matrix, name the workflow as the gate and say that workers do not run it locally. Name deploy-only workflows (Pages, publish on tag) as not a PR gate;
   - sources of truth: where the specs, ADRs, and glossary live.
2. Run each command you found once. A command that fails stays `TODO`, and you add a note saying why.
3. Show the owner the proposed **Project** block and the profile in `.foreman/profile`.
4. Write them only after the owner approves.

When `init.sh` found an `AGENTS.md` already there, it wrote the rendered template to `.foreman/AGENTS.template.md` instead. Merge that file into `AGENTS.md`: keep the owner's rules and filled-in Project values, and add or refresh the factory sections. Show the owner the result, write it only after approval, then delete the template.

Never change the **Authority** section without the owner's explicit approval. Ask about any project rule that narrows it, for example an existing "pause before integration" rule or a tag that publishes a release.

## Migrating from pi-implementation-orchestrator

`init.sh` reports a block between `<!-- pi-implementation-orchestrator:start -->` and `<!-- pi-implementation-orchestrator:end -->`. Replace it rather than adding to it, because two workflows in one `AGENTS.md` contradict each other.

1. **Block.** Delete the whole block. Its review ground rules now live in `agent-guardrails`, its routing in the foreman skill, and its worktree and host rules in the host adapter. Carry over only facts that are specific to the project: the documentation map goes to **Sources of truth**, and resource limits go to **Focused test**. Keep `project/agents/*.md` and all owner text outside the block.
2. **Authority.** The old block paused before integration. Ask the owner whether the foreman may squash-merge after its gates, and list every tag or workflow that publishes a release as needing the owner.
3. **Planning.** Add one line that routes new behavior through `shape-design` → `write-implementation-plan` → `/to-issues`.
4. **Running work.** For each candidate branch an old run left behind, the owner chooses one of:
   - land it: push it as `issue/<n>-<slug>` and file an issue with criteria that name the commit and any merge conflicts against the default branch; finished reviews count as evidence;
   - park it;
   - drop it.

   When a plan's remaining tasks continue, file them as issues per [plan-to-issues.md](plan-to-issues.md), amend the plan's execution model in one commit, and close the old tracker record with links to the new issues. Old run state under `~/.local/state/` is an archive and is never read.
5. **Backlog.** Old tracker records usually lack **Goal**, **Acceptance criteria**, and **Touches**. Leave them unlabelled; `/factory-run` triages each one with the owner. Map old triage labels in the same pass (`ready-for-agent` becomes a lane plus `status:ready`, and `needs-info` becomes `needs:owner`).

The machine-wide cleanup (old package, prompt copies, `orchestrate-implementation`) is in the README and waits until the last project has moved.
