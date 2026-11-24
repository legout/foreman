// Pure data model for the factory status view: GitHub + host JSON in, view and text lines out.

export const ROLES = ["builder-quick", "builder-deep", "builder-ui", "builder", "writer", "tester", "reviewer", "verifier", "scout", "oracle"];
const WORKER_NAME = new RegExp(`^(${ROLES.join("|")})-(\\d+)$`);

export type Dep = { number: number; state: string };
export type Issue = {
	number: number;
	title: string;
	state: "OPEN" | "CLOSED" | string;
	labels: string[];
	parent?: number;
	nativeDeps: Dep[];
	bodyDeps: number[];
	prs: { number: number; ci?: string }[];
	subIssues?: number[]; // known children (epic detail query)
	subTotal?: number;
	subDone?: number;
	partial?: boolean;
};
export type WorkerStatus = "working" | "idle" | "blocked" | "error" | "exited" | "unknown";
export type Worker = {
	host: "herdr" | "paseo" | "bb";
	id: string;
	role: string;
	issue: number;
	status: WorkerStatus;
	model?: string;
	thinking?: string;
	startedMs?: number;
};
export type Gate = "done" | "owner" | "review" | "active" | "waiting" | "ready" | "triage" | "unknown";
export type Task = { issue: Issue; gate: Gate; waitsOn: number[]; workers: Worker[]; stale: boolean; lane?: string };
/** github/hosts: last refresh of every source succeeded; workersKnown: every applicable host has answered at least once. */
export type Health = { github: boolean; hosts: boolean; workersKnown?: boolean };
export type View = {
	epics: { issue: Issue; done: number; total: number; tasks: Task[] }[];
	tasks: Task[]; // every task in view, epic children first
	others: Worker[]; // workers whose issue is not in view
	health: Health;
	notes: string[]; // source errors / limits, shown dim
	partial?: boolean; // open-issue list truncated
};

// ---- parsing ----

export function bodyDeps(body: string | null | undefined): number[] {
	const out = new Set<number>();
	for (const m of (body ?? "").matchAll(/depends on/gi)) {
		const rest = body!.slice(m.index! + m[0].length);
		const end = rest.search(/\n\s*\n|\n#{1,6}\s/);
		for (const n of (end < 0 ? rest : rest.slice(0, end)).matchAll(/#(\d+)/g)) out.add(Number(n[1]));
	}
	return [...out];
}

// biome-ignore lint: GraphQL node shape
export function parseIssue(n: any): Issue {
	return {
		number: n.number,
		title: String(n.title ?? "").replace(/[\u0000-\u001f\u007f-\u009f]/g, " "), // no terminal control chars from issue text
		state: n.state,
		labels: (n.labels?.nodes ?? []).map((l: { name: string }) => l.name),
		parent: n.parent?.number,
		nativeDeps: (n.blockedBy?.nodes ?? []).map((d: Dep) => ({ number: d.number, state: d.state })),
		bodyDeps: bodyDeps(n.body),
		prs: (n.closedByPullRequestsReferences?.nodes ?? [])
			.filter((p: { state: string }) => p.state === "OPEN")
			.map((p: any) => ({ number: p.number, ci: p.commits?.nodes?.[0]?.commit?.statusCheckRollup?.state })),
		subTotal: n.subIssuesSummary?.total,
		subDone: n.subIssuesSummary?.completed,
	};
}

function workerName(name: unknown): { role: string; issue: number } | undefined {
	const m = typeof name === "string" ? WORKER_NAME.exec(name) : null;
	return m ? { role: m[1], issue: Number(m[2]) } : undefined;
}

const HERDR_STATUS: Record<string, WorkerStatus> = { working: "working", done: "idle", blocked: "blocked", error: "error" };
const matchStatus = (s: unknown, rules: [RegExp, WorkerStatus][]): WorkerStatus =>
	rules.find(([re]) => re.test(String(s ?? "")))?.[1] ?? "unknown";

const inPaths = (cwd: string | undefined, paths: Set<string>) => cwd !== undefined && paths.has(cwd.replace(/\/+$/, ""));

export function herdrWorkers(json: any, worktrees: Set<string>): Worker[] {
	const out: Worker[] = [];
	for (const t of json?.terminals ?? []) {
		const w = workerName(t.name);
		if (!w || !inPaths(t.cwd, worktrees)) continue;
		const status = t.state === "live" ? (HERDR_STATUS[t.status] ?? "unknown") : "exited";
		out.push({ host: "herdr", id: t.address, ...w, status });
	}
	return out;
}

export function paseoWorkers(json: any, worktrees: Set<string>, home: string): Worker[] {
	const out: Worker[] = [];
	for (const a of Array.isArray(json) ? json : []) {
		const w = workerName(a.name);
		const cwd = typeof a.cwd === "string" ? a.cwd.replace(/^~(?=\/|$)/, home) : undefined;
		if (!w || !inPaths(cwd, worktrees)) continue;
		const status = matchStatus(a.status, [[/run|work|busy/, "working"], [/^idle$/, "idle"], [/^closed$/, "exited"], [/^error$/, "error"], [/perm|block/, "blocked"]]);
		out.push({ host: "paseo", id: a.shortId ?? a.id, ...w, status, model: String(a.provider ?? "").replace(/^pi\//, "") || undefined, thinking: a.thinking ?? undefined });
	}
	return out;
}

export function bbWorkers(json: any): Worker[] {
	const out: Worker[] = [];
	for (const t of Array.isArray(json) ? json : []) {
		const w = workerName(t.title);
		if (!w || t.archivedAt) continue;
		const status = matchStatus(t.status, [[/run|work|pending|active/, "working"], [/^idle$/, "idle"], [/^error$/, "error"], [/stop/, "exited"]]);
		out.push({ host: "bb", id: t.id, ...w, status, startedMs: typeof t.createdAt === "number" ? t.createdAt : undefined });
	}
	return out;
}

export function parseArgvModel(argv: string[]): { model?: string; thinking?: string } {
	const a = argv.join(" ").split(/\s+/);
	const after = (...flags: string[]) => {
		const i = a.findIndex((x) => flags.includes(x));
		return i >= 0 ? a[i + 1] : undefined;
	};
	const effort = a.find((x) => x.startsWith("model_reasoning_effort="))?.split("=")[1];
	return { model: after("--model", "-m"), thinking: after("--thinking", "--effort", "--reasoning") ?? effort };
}

export function activationDecision(o: { hasProfile: boolean; linkedWorktree: boolean; sessionName?: string }): boolean {
	return o.hasProfile && !o.linkedWorktree && !workerName(o.sessionName);
}

export function runIssueNumbers(text: string): number[] | undefined {
	const m = /^\/factory-run\b(.*)$/s.exec(text.trim());
	return m ? [...m[1].matchAll(/#?(\d+)/g)].map((x) => Number(x[1])) : undefined;
}

// ---- view ----

const depsOf = (i: Issue) => (i.nativeDeps.length ? i.nativeDeps.map((d) => d.number) : i.bodyDeps);

export function buildView(o: { issues: Issue[]; workers: Worker[]; health: Health; epics?: number[]; pinned?: number[]; notes?: string[]; partial?: boolean }): View {
	const byNum = new Map(o.issues.map((i) => [i.number, i]));
	const epicNums = (o.epics ?? []).filter((n) => byNum.has(n));
	const childOf = new Map<number, number>();
	for (const e of epicNums) for (const c of byNum.get(e)!.subIssues ?? []) childOf.set(c, e);
	for (const i of o.issues) if (i.parent && epicNums.includes(i.parent)) childOf.set(i.number, i.parent);
	const workerIssues = new Set(o.workers.map((w) => w.issue));
	const pinned = new Set(o.pinned ?? []);
	const isEpic = (i: Issue) => (i.subTotal ?? i.subIssues?.length ?? 0) > 0;

	const inView = o.issues.filter(
		(i) =>
			!epicNums.includes(i.number) &&
			(childOf.has(i.number) ||
				(!isEpic(i) && (i.labels.some((l) => l.startsWith("status:") || l === "needs:owner") || pinned.has(i.number) || workerIssues.has(i.number)))),
	);

	const isOpenDep = (n: number, native?: Dep) => {
		const known = byNum.get(n);
		if (known) return known.state !== "CLOSED";
		return native ? native.state !== "CLOSED" : true; // unknown blocks
	};
	const task = (i: Issue): Task => {
		const waitsOn = i.nativeDeps.length
			? i.nativeDeps.filter((d) => isOpenDep(d.number, d)).map((d) => d.number)
			: i.bodyDeps.filter((n) => isOpenDep(n));
		const has = (l: string) => i.labels.includes(l);
		const rules: [boolean, Gate][] = [
			[i.state === "CLOSED", "done"],
			[has("needs:owner"), "owner"],
			[has("status:review"), "review"],
			[has("status:active"), "active"],
			[waitsOn.length > 0, "waiting"],
			[!o.health.github, "unknown"], // cached labels, deps not re-checked: never advertise ready
			[has("status:ready"), "ready"],
		];
		const gate = rules.find(([hit]) => hit)?.[1] ?? "triage";
		const workers = o.workers.filter((w) => w.issue === i.number);
		return {
			issue: i, gate, waitsOn, workers,
			stale: gate === "active" && !workers.some((w) => w.status !== "exited") && o.health.github && o.health.hosts && o.health.workersKnown !== false,
			lane: i.labels.find((l) => l.startsWith("lane:"))?.slice(5),
		};
	};
	const tasks = inView.map(task);
	const epics = epicNums.map((e) => {
		const ep = byNum.get(e)!;
		const et = tasks.filter((t) => childOf.get(t.issue.number) === e);
		return {
			issue: ep,
			tasks: et,
			total: ep.subTotal ?? et.length,
			done: ep.subDone ?? et.filter((t) => t.gate === "done").length,
		};
	});
	const shown = new Set(tasks.map((t) => t.issue.number));
	return { epics, tasks, others: o.workers.filter((w) => !shown.has(w.issue)), health: o.health, notes: o.notes ?? [], partial: o.partial };
}

/** Longest-path layer per issue over in-set dependency edges; cycles are cut where detected. */
export function layers(issues: Issue[]): Map<number, number> {
	const byNum = new Map(issues.map((i) => [i.number, i]));
	const out = new Map<number, number>();
	const visiting = new Set<number>();
	const depth = (n: number): number => {
		if (out.has(n)) return out.get(n)!;
		if (visiting.has(n)) return 0;
		visiting.add(n);
		const ds = depsOf(byNum.get(n)!).filter((d) => byNum.has(d));
		const d = ds.length ? 1 + Math.max(...ds.map(depth)) : 0;
		visiting.delete(n);
		out.set(n, d);
		return d;
	};
	for (const i of issues) depth(i.number);
	return out;
}

// ---- text ----

export type Style = (kind: "accent" | "success" | "warning" | "error" | "dim" | "muted", s: string) => string;
const plain: Style = (_k, s) => s;

export const age = (ms?: number, now = Date.now()) => {
	if (!ms) return "";
	const m = Math.max(0, Math.round((now - ms) / 60000));
	return m < 60 ? `${m}m` : `${Math.floor(m / 60)}h${String(m % 60).padStart(2, "0")}`;
};

const STATUS_KIND: Record<WorkerStatus, Parameters<Style>[0]> = { working: "accent", blocked: "error", error: "error", idle: "success", exited: "dim", unknown: "dim" };
const statusKind = (s: WorkerStatus) => STATUS_KIND[s];

export function workerText(w: Worker, st: Style = plain, now = Date.now()): string {
	const model = w.model ? `${w.model.replace(/^[^/]+\//, "")}${w.thinking ? `:${w.thinking}` : ""}` : w.host;
	return `${w.role.padEnd(12)} ${st("muted", model.padEnd(24))} ${st(statusKind(w.status), w.status)} ${age(w.startedMs, now)}`.trimEnd();
}

export function gateText(t: Task, st: Style = plain): string {
	switch (t.gate) {
		case "review": {
			const pr = t.issue.prs[0];
			const ci = pr?.ci ? ` CI ${pr.ci.toLowerCase()}` : "";
			return st(pr?.ci === "FAILURE" || pr?.ci === "ERROR" ? "error" : "warning", `review${pr ? ` PR #${pr.number}` : ""}${ci}`);
		}
		case "owner": return st("error", "needs owner");
		case "waiting": return st("dim", `waits ${t.waitsOn.map((n) => `#${n}`).join(", ")}`);
		case "active": return t.stale ? st("warning", "active, no worker") : st("accent", "active");
		case "done": return st("success", "done");
		case "unknown": return st("warning", "unknown (github stale)");
		default: return st("dim", t.gate);
	}
}

export function widgetLines(v: View, st: Style = plain, now = Date.now(), max = 8): string[] {
	const working = [...v.tasks.flatMap((t) => t.workers), ...v.others].filter((w) => w.status === "working").length;
	const count = (g: Gate) => v.tasks.filter((t) => t.gate === g).length;
	const ep = v.epics[0];
	const parts = [st("accent", "foreman")];
	if (ep) parts.push(`#${ep.issue.number} ${ep.issue.title}${ep.issue.partial ? " (partial)" : ""}`);
	parts.push(v.health.workersKnown === false ? st("dim", "workers loading") : `${working} working`);
	for (const [g, label] of [["review", "review"], ["owner", "owner"]] as const) if (count(g)) parts.push(`${count(g)} ${label}`);
	const stale = v.tasks.filter((t) => t.stale).length;
	if (stale) parts.push(`${stale} stale`);
	if (ep) parts.push(`${ep.done}/${ep.total} done`);
	if (v.epics.length > 1) parts.push(`+${v.epics.length - 1} epics`);
	if (v.partial) parts.push(st("warning", "partial: >100 open issues"));
	const lines = [parts.join(st("dim", " · "))];

	const body: string[] = [];
	const title = (t: Task) => st("dim", t.issue.title);
	for (const t of v.tasks.filter((t) => t.workers.length && t.gate !== "done"))
		for (const w of t.workers) {
			const gate = t.gate === "review" || t.gate === "owner" ? `${gateText(t, st)}  ` : "";
			body.push(`${st(statusKind(w.status), "●")} #${t.issue.number} ${workerText(w, st, now)}  ${gate}${title(t)}`);
		}
	for (const g of ["review", "owner"] as const)
		for (const t of v.tasks.filter((t) => t.gate === g && !t.workers.length)) body.push(`${g === "owner" ? st("error", "?") : st("warning", "◆")} #${t.issue.number} ${gateText(t, st)}  ${title(t)}`);
	for (const t of v.tasks.filter((t) => t.stale)) body.push(`${st("warning", "!")} #${t.issue.number} ${gateText(t, st)}  ${title(t)}`);
	for (const w of v.others) body.push(`${st(statusKind(w.status), "●")} #${w.issue} ${workerText(w, st, now)}  ${st("dim", "(not in plan)")}`);

	const next = v.tasks.filter((t) => !t.workers.length && ["ready", "waiting", "triage"].includes(t.gate));
	next.sort((a, b) => ["ready", "waiting", "triage"].indexOf(a.gate) - ["ready", "waiting", "triage"].indexOf(b.gate) || a.issue.number - b.issue.number);
	const why = (t: Task) => {
		if (t.gate === "waiting") return ` (waits ${t.waitsOn.map((n) => `#${n}`).join(", ")})`;
		return t.gate === "triage" ? " (triage)" : "";
	};
	const more = next.length > 3 ? ` · +${next.length - 3}` : "";
	const nextLine = next.length ? `${st("dim", "○")} next: ${next.slice(0, 3).map((t) => `#${t.issue.number}${why(t)}`).join(" · ")}${more}` : undefined;

	const room = max - 1 - (nextLine ? 1 : 0) - (v.notes.length ? 1 : 0);
	if (body.length > room) body.splice(room - 1, body.length, st("dim", `… +${body.length - room + 1} more (/factory-status)`));
	lines.push(...body);
	if (nextLine) lines.push(nextLine);
	if (v.notes.length) lines.push(st("warning", `⚠ ${v.notes.join(" · ")}`));
	return lines;
}

/** Full plan as lines for the overlay. */
export function planLines(v: View, st: Style = plain, now = Date.now()): string[] {
	const out: string[] = [];
	const taskLine = (t: Task) => {
		const mark = t.gate === "done" ? st("success", "✓") : t.workers.some((w) => w.status === "working") ? st("accent", "●") : t.gate === "owner" ? st("error", "?") : st("dim", "○");
		const lane = t.lane ? st("dim", ` [${t.lane}]`) : "";
		const head = `  ${mark} #${t.issue.number} ${t.issue.title}${lane}  ${gateText(t, st)}`;
		return [head, ...t.workers.map((w) => `      ${st("dim", "└")} ${workerText(w, st, now)} ${st("dim", w.host)}`)];
	};
	for (const e of v.epics) {
		out.push(st("accent", `#${e.issue.number} ${e.issue.title}`) + st("dim", ` · ${e.done}/${e.total} done${e.issue.partial ? " · partial" : ""}`));
		const L = layers(e.tasks.map((t) => t.issue));
		const max = Math.max(-1, ...L.values());
		for (let k = 0; k <= max; k++) {
			const ts = e.tasks.filter((t) => L.get(t.issue.number) === k);
			if (!ts.length) continue;
			const done = ts.filter((t) => t.gate === "done").length;
			out.push(st("muted", ` layer ${k + 1}`) + st("dim", ` · ${ts.length} tasks${done ? ` · ${done} done` : ""}`));
			for (const t of ts.sort((a, b) => a.issue.number - b.issue.number)) out.push(...taskLine(t));
		}
		out.push("");
	}
	const inEpic = new Set(v.epics.flatMap((e) => e.tasks.map((t) => t.issue.number)));
	const loose = v.tasks.filter((t) => !inEpic.has(t.issue.number));
	if (loose.length) {
		out.push(st("accent", "Standalone"));
		for (const t of loose) out.push(...taskLine(t));
		out.push("");
	}
	if (v.others.length) {
		out.push(st("accent", "Other workers"));
		for (const w of v.others) out.push(`  ● #${w.issue} ${workerText(w, st, now)} ${st("dim", w.host)}`);
		out.push("");
	}
	const edges = v.tasks.flatMap((t) => depsOf(t.issue).map((d) => `  #${d} → #${t.issue.number}`));
	if (edges.length) out.push(st("accent", "Dependencies"), ...edges.map((e) => st("dim", e)));
	if (v.notes.length) out.push("", st("warning", `⚠ ${v.notes.join(" · ")}`));
	if (v.partial) out.push("", st("warning", "⚠ partial: more than 100 open issues, older ones not shown"));
	return out;
}
