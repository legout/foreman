# Roles and profiles

## Profiles

A profile maps each role to an ordered chain of `{model, thinking}` entries. Use the first entry that is available; if you fall back, say so in the issue comment.

| Profile | For |
|---|---|
| `mixed` | Claude, ChatGPT, GLM, and Kimi subscriptions. Reviewers come from a different family than builders. |
| `chatgpt` | ChatGPT only. One family, so the reviewer uses a higher tier than the builder. |
| `claude` | Claude only. One family, so the reviewer uses a higher tier than the builder. |
| `open-weights` | GLM, Kimi, DeepSeek, and MiniMax, through direct APIs, CommandCode, or OpenCode Go. |

How a profile is chosen and applied:

- The repository picks its profile in `.foreman/profile`, which contains one line with the profile name.
- To customise a profile, copy it to `.foreman/<name>.json`. A copy there takes precedence over the built-in profile.
- `"cli"` sets the worker CLI for the whole profile (`pi` by default). An entry can override it with its own `"cli"`.
- Model IDs are written as `provider/model` for `pi` and `omp`. The other CLIs drop the provider prefix; the host adapter maps each entry to the host's own provider and thinking IDs.

## Roles

| Role | Lane or label | Writes | Skills |
|---|---|---|---|
| `builder-quick` | quick | code | guardrails |
| `builder` | standard | code and tests | guardrails, tdd, systematic-debugging |
| `builder-deep` | deep | code | guardrails, tdd, systematic-debugging |
| `builder-ui` | `ui` | code | guardrails, tdd, impeccable |
| `writer` | `docs` | docs | guardrails, documentation-writer |
| `tester` | deep | tests | guardrails, tdd |
| `reviewer` | risk trigger, deep | — | guardrails |
| `verifier` | deep | — | guardrails, the project's `verify-*` recipe |
| `scout` | spike | — | research |
| `oracle` | spike, stuck | — | guardrails |

Each shipped profile keeps the reviewer on a model that no builder uses, and keeps the tester on a different model from `builder-deep`. When you edit a profile, keep both properties, and prefer a different model family.

Roles marked `—` are read-only. Launch them read-only as the host adapter describes, each in its own checkout at the PR head.

Gather context inside a worker with that CLI's own subagents. Never start an extra factory worker just to gather context.
