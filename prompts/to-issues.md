---
description: Turn an approved spec or plan into factory-ready GitHub issues
argument-hint: "<spec-or-plan-path>"
---

Turn `$1` into GitHub issues that the foreman can run. Use `write-implementation-plan` for the decomposition and `planning-contract` for the readiness checks. If `$1` is not approved, stop and tell me what is still missing.

Every task becomes one issue that follows the issue format in `AGENTS.md`: Goal, checkable Acceptance criteria, Touches, Source (link to `$1`), and Depends on #n. Make each issue small enough for one PR. Add the issues as sub-issues of an epic issue that links `$1`.

Propose a `lane:*` label for each issue, plus `ui` or `docs` where they apply, with a one-line reason. Use the cheapest lane that can succeed. Do not set `status:ready`; the foreman sets it during triage.

Show me the issue list (title, lane, depends on) before you create anything, and create the issues only after I approve the list.
