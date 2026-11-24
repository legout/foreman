import assert from "node:assert/strict";
import { test } from "node:test";
import {
	activationDecision,
	buildView,
	herdrWorkers,
	layers,
	parseArgvModel,
	parseIssue,
	runIssueNumbers,
	widgetLines,
	type Issue,
	type Worker,
} from "./model.ts";

const issue = (n: number, extra: Partial<Issue> = {}): Issue => ({
	number: n, title: `T${n}`, state: "OPEN", labels: [], parent: undefined,
	nativeDeps: [], bodyDeps: [], prs: [], ...extra,
});
const worker = (issueN: number, role = "builder", status: Worker["status"] = "working"): Worker =>
	({ host: "herdr", id: `t${issueN}`, role, issue: issueN, status });
const healthy = { github: true, hosts: true };

test("gate and workers are independent", () => {
	const issues = [
		issue(1, { labels: ["status:review"], prs: [{ number: 9, ci: "PENDING" }] }),
		issue(2, { labels: ["needs:owner", "status:active"] }),
		issue(3, { labels: ["status:active"] }),
	];
	const v = buildView({ issues, workers: [worker(1, "builder", "idle"), worker(2)], health: healthy });
	const t = (n: number) => v.tasks.find((x) => x.issue.number === n)!;
	assert.equal(t(1).gate, "review");
	assert.equal(t(1).workers.length, 1);
	assert.equal(t(2).gate, "owner");
	assert.equal(t(2).workers[0].status, "working");
	assert.equal(t(3).stale, true);
	// stale only when every source answered
	const v2 = buildView({ issues, workers: [], health: { github: true, hosts: false } });
	assert.equal(v2.tasks.find((x) => x.issue.number === 3)!.stale, false);
	const v3 = buildView({ issues, workers: [], health: { ...healthy, workersKnown: false } });
	assert.equal(v3.tasks.find((x) => x.issue.number === 3)!.stale, false);
	// a cached ready issue is not advertised as ready once GitHub fails
	const ready = [issue(4, { labels: ["status:ready"] })];
	assert.equal(buildView({ issues: ready, workers: [], health: healthy }).tasks[0].gate, "ready");
	assert.equal(buildView({ issues: ready, workers: [], health: { github: false, hosts: true } }).tasks[0].gate, "unknown");
});

test("native edges win, body deps are the fallback, unknown blocks", () => {
	const raw = (n: number, body: string, blockedBy: number[]) => ({
		number: n, title: "x", state: "OPEN", body, labels: { nodes: [] }, parent: null,
		blockedBy: { nodes: blockedBy.map((b) => ({ number: b, state: "OPEN" })) },
		closedByPullRequestsReferences: { nodes: [] },
	});
	const a = parseIssue(raw(58, "## Depends on\n#57 (T1)\n", []));
	assert.deepEqual(a.bodyDeps, [57]);
	const b = parseIssue(raw(59, "Depends on #57 and #58", [40]));
	assert.deepEqual(b.nativeDeps.map((d) => d.number), [40]);
	const issues = [issue(57), { ...a, labels: ["status:ready"] }, issue(60, { bodyDeps: [999], labels: ["status:ready"] })];
	const v = buildView({ issues, workers: [], health: healthy });
	const t = (n: number) => v.tasks.find((x) => x.issue.number === n)!;
	assert.equal(t(58).gate, "waiting"); // #57 open beats status:ready
	assert.deepEqual(t(58).waitsOn, [57]);
	assert.equal(t(60).gate, "waiting"); // #999 not in view: unknown, never ready
	assert.deepEqual(t(60).waitsOn, [999]);
	const closedDep = buildView({ issues: [issue(57, { state: "CLOSED" }), { ...a, labels: ["status:ready"] }], workers: [], health: healthy });
	assert.equal(closedDep.tasks.find((x) => x.issue.number === 58)!.gate, "ready");
});

test("layers: diamond and cycle", () => {
	const d = [issue(1), issue(2, { bodyDeps: [1] }), issue(3, { bodyDeps: [1] }), issue(4, { bodyDeps: [2, 3] })];
	assert.deepEqual([...layers(d).entries()].sort(), [[1, 0], [2, 1], [3, 1], [4, 2]]);
	const c = layers([issue(1, { bodyDeps: [2] }), issue(2, { bodyDeps: [1] })]);
	assert.equal(c.size, 2);
});

const hcSample = {
	terminals: [
		{ address: "t83", agent: "pi", cwd: "/r/featherbi", state: "live", status: "done" },
		{ address: "t8f", agent: "pi", cwd: "/w/featherbi/57-tracer-bullet", name: "builder-ui-57", parent: "t83", state: "live", status: "working" },
		{ address: "t73", agent: "pi", cwd: "/w/ariadne-b1", name: "builder-12", parent: "t83", state: "live", status: "done" },
		{ address: "t99", agent: "zsh", cwd: "/w/featherbi/57-tracer-bullet", state: "live" },
	],
};

test("herdr: name and repo worktree must both match", () => {
	const ws = herdrWorkers(hcSample, new Set(["/w/featherbi/57-tracer-bullet"]));
	// exact path only: another repo nested below a worktree is not ours
	assert.deepEqual(herdrWorkers(hcSample, new Set(["/w"])), []);
	assert.deepEqual(ws.map((w) => [w.id, w.role, w.issue, w.status]), [["t8f", "builder-ui", 57, "working"]]);
	const argv = ["/usr/bin/zsh", "-lic", "exec pi --name builder-ui-57 --model claude-code/claude-fable-5-2 --thinking high --no-skills"];
	assert.deepEqual(parseArgvModel(argv), { model: "claude-code/claude-fable-5-2", thinking: "high" });
	assert.deepEqual(parseArgvModel(["sh", "-lic", "exec codex -m gpt-6 -c model_reasoning_effort=xhigh -a never"]), { model: "gpt-6", thinking: "xhigh" });
});

test("activation: workers stay quiet", () => {
	assert.equal(activationDecision({ hasProfile: true, linkedWorktree: true, sessionName: undefined }), false);
	assert.equal(activationDecision({ hasProfile: true, linkedWorktree: false, sessionName: "builder-57" }), false);
	assert.equal(activationDecision({ hasProfile: true, linkedWorktree: false, sessionName: "foreman" }), true);
	assert.equal(activationDecision({ hasProfile: false, linkedWorktree: false, sessionName: undefined }), false);
});

test("factory-run input pins issues", () => {
	assert.deepEqual(runIssueNumbers("/factory-run 42 #43"), [42, 43]);
	assert.deepEqual(runIssueNumbers("/factory-run"), []);
	assert.equal(runIssueNumbers("hello 42"), undefined);
});

test("widget: running first, then gates, then next", () => {
	const epic = issue(56, { title: "Epic", subIssues: [57, 58, 59, 60] });
	const issues = [
		epic,
		issue(57, { parent: 56, labels: ["status:active"] }),
		issue(58, { parent: 56, bodyDeps: [57] }),
		issue(59, { parent: 56, state: "CLOSED" }),
		issue(60, { parent: 56, labels: ["needs:owner"] }),
		issue(61, { parent: 56, labels: ["status:review"], prs: [{ number: 70, ci: "FAILURE" }] }),
	];
	const w = { ...worker(57, "builder-ui"), model: "claude-fable-5-2", thinking: "high" };
	const idle = worker(61, "builder", "idle");
	const lines = widgetLines(buildView({ issues, workers: [w, idle], health: healthy, epics: [56] }));
	assert.match(lines[0], /#56 Epic .*1 working.*1 review.*1 owner.*1\/5 done/);
	assert.match(lines[1], /#57 builder-ui +claude-fable-5-2:high +working/);
	assert.match(lines[2], /#61 builder .*idle +review PR #70 CI failure/); // worker row keeps the gate
	assert.match(lines[3], /#60 .*needs owner/);
	assert.match(lines[4], /next: #58 \(waits #57\)/);
	const loading = widgetLines(buildView({ issues, workers: [], health: { ...healthy, workersKnown: false }, epics: [56], partial: true }));
	assert.match(loading[0], /workers loading/);
	assert.match(loading[0], /partial/);
});
