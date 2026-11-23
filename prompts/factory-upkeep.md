---
description: File owner-approved cleanup issues (deslop, test-diet) for the factory
argument-hint: "[deslop|test-diet|both] [path ...]"
---

Prepare periodic upkeep for the factory. Mode: ${1:-both}. Scope: ${@:2}. If no scope is given, use the whole repository.

- **deslop**: run the `deslop` skill in proposal mode only, and do not edit anything.
- **test-diet**: run the `test-diet` skill as far as its proposal (the inventory, the proof map, and the per-test classification). Delete nothing.

Show me the proposals. For each item I approve, file one GitHub issue that follows the issue format in `AGENTS.md`. Each issue's Source is the approved proposal and its Touches are the files involved. Label it `lane:standard`, and use `lane:deep` instead when it touches persistence or a public contract.

The foreman then runs these issues like any other work.
