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
2. Create an epic issue that links the plan. Then create each task issue and add it as a sub-issue of the epic: `gh issue create`, then `gh api repos/<o>/<r>/issues/<epic>/sub_issues -f sub_issue_id=<id>`. Fill in the `Depends on` numbers as you go.
3. Leave `status:ready` unset; the foreman sets it during triage.
