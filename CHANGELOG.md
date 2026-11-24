# Changelog

All notable changes to Foreman. Versions follow [SemVer](https://semver.org/); each release is also a [GitHub release](https://github.com/legout/foreman/releases).

## Unreleased

### New
- Pi status view: a widget above the editor shows running workers and the plan's next tasks; `/factory-status` opens the epic as dependency layers. Read-only, GitHub plus host CLIs, off in worker sessions. Remote Paseo daemons and MCP-only Paseo are not covered.

## 0.2.0 - 2026-11-24

First tagged release. Pin it with `FOREMAN_REF=v0.2.0` in the install command.

**Existing projects: re-run init.** The `AGENTS.md` template and labels changed. Re-run the install command, then `init.sh <repo>` without a preset, then `/factory-init` to merge `.foreman/AGENTS.template.md`.

### New
- `/factory-job "<goal>"`: bounded goals become an epic with up to five issues and dispatch immediately; bigger work goes to `shape-design`.
- Default-branch CI baseline before dispatch; only exact pre-existing failures can be exempted.
- Final epic verification can file missing in-scope work for up to two extend rounds, then asks the owner.
- `/to-issues` writes native GitHub *blocked by* edges; dispatch reads them first, falling back to `Depends on #n`.
- `opencode-go` model preset.
- Versioning: `init.sh` stamps `.foreman/version`, `doctor.sh` warns when a project is behind, `FOREMAN_REF` pins an install.

### Changed
- The Foreman no longer blocks in `hc wait` on Herdr: workers wake it with `hc send`, so it accepts instructions while workers run.
- Presets: Foreman runs on Terra/Sonnet at `high`; GLM 5.3 → 5.4; Haiku preferred over Luna; Kimi K3.1 Pro added to UI builders.
- `init.sh` and `doctor.sh` use Node instead of Python.
- README rewritten as a getting-started guide.

### Fixed
- `init.sh` no longer replaces an existing `CLAUDE.md`, no longer skips projects with an existing `AGENTS.md` (it renders a merge template), and keeps the chosen profile on re-run.
- `doctor.sh` checks every skill `setup.sh` installs.


## 0.1.0 - 2026-11-23

Initial version: the `foreman` skill with quick, standard, deep and spike lanes; host adapters for Herdr, Paseo and BB; model profiles; `install.sh`, `setup.sh`, `init.sh` and `doctor.sh`; `/to-issues`, `/factory-init`, `/factory-run` and `/factory-upkeep`. Not tagged.
