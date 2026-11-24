# Initialize a repository

`init.sh <repo>` has already done the mechanical part. It wrote `AGENTS.md` with detected values — or `.foreman/AGENTS.template.md` when `AGENTS.md` already existed — created the labels, and wrote `.foreman/profile`. Your job is to fill in whatever is still marked `TODO` in `AGENTS.md`.

1. For each `TODO` in the **Project** section, find the real value in the repository:
   - setup: the README, `package.json` scripts, `pyproject.toml`, `Makefile`, `justfile`, or a devcontainer;
   - focused test: the test runner and its single-file form;
   - full gate: the steps in `.github/workflows/*`;
   - sources of truth: where the specs, ADRs, and glossary live.
2. Run each command you found once. A command that fails stays `TODO`, and you add a note saying why.
3. Show the owner the proposed **Project** block and the profile in `.foreman/profile`.
4. Write them only after the owner approves.

When `init.sh` found an `AGENTS.md` already there, it wrote the rendered template to `.foreman/AGENTS.template.md` instead. Merge that file into `AGENTS.md`: keep the owner's rules and filled-in Project values, and add or refresh the factory sections. Show the owner the result, write it only after approval, then delete the template.

Never change the **Authority** section without the owner's explicit approval.
