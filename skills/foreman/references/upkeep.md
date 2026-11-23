# Upkeep issues

Upkeep turns cleanup proposals into issues that the factory runs. Use one of two modes: `deslop`, `test-diet`, or both. The scope is the paths the owner named; if none were named, use the whole repository.

- **deslop**: run the `deslop` skill in proposal mode only. Edit nothing.
- **test-diet**: run the `test-diet` skill up to its proposal: the inventory, the proof map, and the per-test classification. Delete nothing.

Show the proposals to the owner. For every item the owner approves, file one issue in the `AGENTS.md` format:

- **Source**: the approved proposal.
- **Touches**: the files the item involves.
- **Label**: `lane:standard`. Use `lane:deep` instead when the item touches persistence or a public contract.
