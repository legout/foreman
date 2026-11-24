# Default-branch baseline

Before the epic's first dispatch, resolve the remote default-branch HEAD and review the required CI checks on that exact SHA. Record the SHA and result on the epic. For red CI, record each failing check name, its failure signature from the logs, and a link to the run. Dispatch only a prerequisite fix issue, or set `needs:owner` and hold the epic if the fix is outside the grant. If required CI is pending or its result cannot be established, hold dispatch. For work without an epic, record the baseline on the scoped issue.

For each PR, exempt a baseline failure only if that exact check and failure signature are unchanged, still present on the current default branch, and covered by the project's CI authority. Pending, missing, new or changed failures do not qualify. Never bypass required GitHub checks or branch protection. Record any exemption with the merge evidence.
