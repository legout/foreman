# Roles

Use the first available entry in each role's model chain. If you fall back to a later entry, say so in the issue comment.

A reviewer or tester must come from a different model family than the builder whose work it checks.

| Role | Lane / label | Writes | Model chain | Skills |
|---|---|---|---|---|
| `builder-quick` | quick | code | `zai/glm-5.3-flash:low` → `openai-codex/gpt-6-luna:low` → `claude-code/claude-haiku-5-5:low` | guardrails |
| `builder` | standard | code + tests | `claude-code/claude-sonnet-5-5:high` → `zai/glm-5.3:high` → `openai-codex/gpt-6.1-terra:high` | guardrails, tdd, systematic-debugging |
| `builder-deep` | deep | code | `claude-code/claude-opus-5-5:high` → `openai-codex/gpt-6.2-sol:high` | guardrails, tdd, systematic-debugging |
| `builder-ui` | `ui` | code | `claude-code/claude-fable-5-2:high` → `claude-code/claude-opus-5-5:high` | guardrails, tdd, impeccable |
| `writer` | `docs` | docs | `claude-code/claude-sonnet-5-5:medium` → `openai-codex/gpt-6.1-terra:medium` | guardrails, documentation-writer |
| `tester` | deep | tests | `openai-codex/gpt-6.1-terra:high` → `zai/glm-5.3:high` | guardrails, tdd |
| `reviewer` | risk trigger, deep | — | `openai-codex/gpt-6.2-sol:xhigh` → `kimi-coding/k3.1-pro:max` → `claude-code/claude-opus-5-5:xhigh` | guardrails |
| `verifier` | deep | — | `zai/glm-5.3:medium` → `openai-codex/gpt-6.1-terra:medium` | guardrails, project `verify-*` recipe |
| `scout` | spike | — | `zai/glm-5.3-flash:low` | research |
| `oracle` | spike, stuck | — | `openai-codex/gpt-6.2-astra:xhigh` → `claude-code/claude-opus-5-5:xhigh` | guardrails |

**Loading skills.** Start workers with `--no-skills` and pass one `--skill ~/.agents/skills/<name>` per skill listed for the role. A worker then carries only the skill descriptions for its role, and off-role skills cannot trigger.

**Read-only roles.** Add `--exclude-tools edit,write` for every role whose Writes column is `—`. Reviewers and verifiers can still use `gh` and `git` through bash, so keep them in a detached worktree.

**Context gathering inside a session.** Use Pi's own `pi-subagents` (scout/researcher) for this. Never start an extra Herdr session just to gather context.
