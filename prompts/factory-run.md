---
description: Start the foreman loop on this repository's GitHub backlog
argument-hint: "[issue numbers or label filter]"
---

Run the software factory with the `foreman` skill on this repository. Scope: ${@:-every open issue}.

Follow the startup checks in the skill. If any check fails, stop and report which one failed. Otherwise keep the loop running until nothing ready is left in scope. End with:

- every merged PR, with its issue;
- every issue labeled `needs:owner`, with its question;
- anything still active.
