# Plan to issues

The input is an approved plan from `write-implementation-plan`. Map its tasks to issues; do not slice the work again. If the plan is not approved under `planning-contract`, or if any task lacks files or a completion criterion, stop and name the gap.

## Mapping

| Plan field | Issue |
|---|---|
| Task title | Title |
| Behavior and edge cases | **Goal** (one line) plus context |
| Completion criterion and the behavior it proves | **Acceptance criteria** (checkboxes) |
| Exact files to create or modify | **Touches** |
| Prerequisites | **Depends on #n** (the issue numbers of those tasks) |
| Plan path and task number | **Source** |
| Validation unit and focused command | A **Validation** section, copied verbatim; the foreman copies it into the brief |

Pick each lane from the task's validation risk class:

- **low risk** → `lane:quick`;
- **normal risk** → `lane:standard`;
- **high risk** → `lane:deep`;
- the plan's **final verification task** → `lane:deep`, with `Depends on` listing every implementation issue. It is verify-only: verifier role, no builder.

Add `ui` or `docs` wherever they fit. Keep an expand → migrate → contract sequence as a chain of dependencies, and never merge its steps into one issue.

## Steps

1. Show the table of title, lane, and depends-on, and wait for the owner's approval.
2. Create an epic linking the plan, then use the issue and edge steps below.

## Issues and edges

1. Use `gh issue create` for each task, in dependency order, with its `Depends on #n` text. Add it to the epic: `gh api repos/<o>/<r>/issues/<epic>/sub_issues -F sub_issue_id=<id>` (numeric REST ID, not issue number).
2. For every edge, write the native relationship on the blocked issue:
   ```sh
   id=$(gh api "repos/$repo/issues/$prerequisite" --jq .id)
   gh api --method POST "repos/$repo/issues/$blocked/dependencies/blocked_by" -F "issue_id=$id"
   ```
3. Leave `status:ready` unset for triage. If an edge write fails, flag the affected issue `needs:owner` and report the missing edge instead of dispatching it.

For triage, read `gh api --paginate "repos/$repo/issues/$issue/dependencies/blocked_by" --jq '.[] | {number, state}'`. Native edges are authoritative when present; if empty or unsupported, read the issue body's `Depends on #n` entries. Other API errors are not evidence that the issue is unblocked.
