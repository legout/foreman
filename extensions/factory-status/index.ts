// Foreman status view: widget above the editor + /factory-status overlay. Read-only; GitHub stays the only plan state.
import { homedir } from "node:os";
import type { ExtensionAPI, ExtensionContext, Theme } from "@earendil-works/pi-coding-agent";
import { matchesKey, truncateToWidth } from "@earendil-works/pi-tui";
import {
	activationDecision,
	bbWorkers,
	buildView,
	herdrWorkers,
	type Issue,
	parseArgvModel,
	parseIssue,
	paseoWorkers,
	planLines,
	runIssueNumbers,
	type Style,
	type View,
	type Worker,
	widgetLines,
} from "./model.ts";

const KEY = "factory-status";
const HOST_MS = 15_000;
const GITHUB_MS = 60_000;
const EPIC_DEBOUNCE_MS = 30_000;
const FIELDS = `number title state body labels(first:20){nodes{name}} parent{number}
  blockedBy(first:20){nodes{number state}}
  closedByPullRequestsReferences(first:3,includeClosedPrs:false){nodes{number state commits(last:1){nodes{commit{statusCheckRollup{state}}}}}}`;
const Q_OPEN = `query($o:String!,$n:String!){repository(owner:$o,name:$n){issues(states:OPEN,first:100,orderBy:{field:UPDATED_AT,direction:DESC}){
  pageInfo{hasNextPage} nodes{ ${FIELDS} subIssuesSummary{total completed} }}}}`;
const qEpics = (nums: number[]) =>
	`query($o:String!,$n:String!){repository(owner:$o,name:$n){${nums
		.map((n) => `e${n}:issue(number:${n}){ ${FIELDS} subIssuesSummary{total completed} subIssues(first:100){totalCount nodes{ ${FIELDS} }}}`)
		.join(" ")}}}`;

type Source = { ok?: boolean; error?: string; at?: number };

export default function factoryStatus(pi: ExtensionAPI) {
	let ctx: ExtensionContext | undefined;
	let active = false;
	let forced: boolean | undefined; // /factory-status on|off
	let root = "";
	let repo: { owner: string; name: string } | undefined;
	let worktrees = new Set<string>();
	let hosts: { hc: boolean; paseo: boolean } = { hc: false, paseo: false };
	let openIssues: Issue[] = [];
	let partialOpen = false;
	type EpicDetail = { epic: Issue; children: Issue[]; partial: boolean; summary: string };
	let epicDetail = new Map<number, EpicDetail>();
	let workers: Worker[] = [];
	const herdrMeta = new Map<string, { model?: string; thinking?: string; startedMs?: number }>();
	const sources: Record<string, Source> = {};
	let pinnedEpic: number | undefined;
	const runIssues = new Set<number>();
	let timer: ReturnType<typeof setInterval> | undefined;
	let abort = new AbortController();
	let gen = 0; // bumped by start/stop; collectors of an older generation must not write shared state
	let busy = { gh: false, hosts: false, epics: false };
	let lastGithub = 0;
	let lastEpics = 0;
	let backoffUntil = 0; // shared by both GraphQL queries
	let backoffMs = GITHUB_MS;
	let epicsWanted = true;
	let view: View | undefined;
	const listeners = new Set<() => void>();

	const exec = async (cmd: string, args: string[], timeout = 10_000) => {
		const signal = abort.signal;
		const r = await pi.exec(cmd, args, { cwd: root || ctx?.cwd, timeout, signal });
		if (signal.aborted) throw new Error("aborted");
		if (r.code !== 0) throw new Error((r.stderr || r.stdout).trim().split("\n").pop() || `${cmd} exit ${r.code}`);
		return r.stdout;
	};
	const has = async (cmd: string) => {
		try {
			await exec("sh", ["-c", `command -v ${cmd}`]);
			return true;
		} catch {
			return false;
		}
	};
	const mark = (name: string, error?: unknown) => {
		if (error instanceof Error && error.message === "aborted") return; // a stopped generation reports nothing
		sources[name] = error === undefined
			? { ok: true, at: Date.now() }
			: { ...sources[name], ok: false, error: String((error as Error)?.message ?? error).slice(0, 80) };
	};

	// ---- collectors ----

	async function refreshWorktrees() {
		const out = await exec("git", ["worktree", "list", "--porcelain"]);
		const paths = [...out.matchAll(/^worktree (.+)$/gm)].map((m) => m[1]);
		worktrees = new Set(paths.slice(1)); // first entry is the main checkout
	}

	async function refreshHosts() {
		if (busy.hosts) return;
		busy.hosts = true;
		const g = gen;
		try {
			await refreshWorktrees().then(() => mark("git"), (e) => mark("git", e));
			const found: Worker[] = [];
			if (hosts.hc) {
				try {
					const ws = herdrWorkers(JSON.parse(await exec("hc", ["ls", "--json"])), worktrees);
					for (const w of ws) {
						if (!herdrMeta.has(w.id)) {
							try {
								const t = JSON.parse(await exec("hc", ["get", w.id, "--json"]));
								herdrMeta.set(w.id, { ...parseArgvModel(t.argv ?? []), startedMs: t.created_ms });
							} catch {
								// gone between ls and get, or transient: show it without model this round
							}
						}
						found.push({ ...w, ...herdrMeta.get(w.id) });
					}
					mark("hc");
				} catch (e) {
					mark("hc", e);
					found.push(...workers.filter((w) => w.host === "herdr"));
				}
			}
			if (hosts.paseo) {
				try {
					found.push(...paseoWorkers(JSON.parse(await exec("paseo", ["ls", "--json"])), worktrees, homedir()));
					mark("paseo");
				} catch (e) {
					mark("paseo", e);
					found.push(...workers.filter((w) => w.host === "paseo"));
				}
			}
			if (process.env.BB_THREAD_ID) {
				try {
					found.push(...bbWorkers(JSON.parse(await exec("bb", ["thread", "list", "--parent-thread", process.env.BB_THREAD_ID, "--json"]))));
					mark("bb");
				} catch (e) {
					mark("bb", e);
					found.push(...workers.filter((w) => w.host === "bb"));
				}
			}
			if (g === gen) workers = found;
		} finally {
			if (g === gen) busy.hosts = false;
		}
	}

	const ghFailed = (name: string, e: unknown) => {
		mark(name, e);
		if (/rate limit|secondary rate/i.test(String((e as Error)?.message ?? e))) {
			backoffUntil = Date.now() + backoffMs;
			backoffMs = Math.min(backoffMs * 2, 10 * 60_000);
		}
	};
	const ghOk = (name: string) => {
		mark(name);
		if (sources.github?.ok !== false && sources.epics?.ok !== false) backoffMs = GITHUB_MS;
	};
	const gql = async (query: string) => {
		if (!repo) throw new Error("repo unknown");
		const out = JSON.parse(await exec("gh", ["api", "graphql", "-f", `query=${query}`, "-f", `o=${repo.owner}`, "-f", `n=${repo.name}`], 20_000));
		if (out.errors?.length) throw new Error(out.errors[0].message);
		return out.data.repository;
	};

	const epicNumbers = () => {
		if (pinnedEpic) return [pinnedEpic];
		return openIssues.filter((i) => (i.subTotal ?? 0) > 0 && (i.subDone ?? 0) < (i.subTotal ?? 0)).slice(0, 3).map((i) => i.number);
	};

	async function refreshGithub() {
		if (busy.gh) return;
		busy.gh = true;
		const g = gen;
		try {
			if (!repo) {
				const nwo = (await exec("gh", ["repo", "view", "--json", "nameWithOwner", "-q", ".nameWithOwner"])).trim();
				const [owner, name] = nwo.split("/");
				repo = { owner, name };
			}
			const r = await gql(Q_OPEN);
			if (g !== gen) return;
			// biome-ignore lint: GraphQL node shape
			openIssues = r.issues.nodes.map((n: any) => parseIssue(n));
			partialOpen = r.issues.pageInfo.hasNextPage;
			lastGithub = Date.now();
			for (const e of epicNumbers()) {
				const i = openIssues.find((x) => x.number === e);
				const summary = `${i?.subDone}/${i?.subTotal}`;
				if (epicDetail.get(e)?.summary !== summary) epicsWanted = true;
			}
			ghOk("github");
		} catch (e) {
			lastGithub = Date.now();
			ghFailed("github", e);
		} finally {
			if (g === gen) busy.gh = false;
		}
		if (g !== gen) return;
		const nums = epicNumbers();
		if (repo && nums.length && Date.now() >= backoffUntil && (epicsWanted || nums.some((n) => !epicDetail.has(n)))) await refreshEpics(nums);
	}

	async function refreshEpics(nums = epicNumbers()) {
		if (busy.epics || !nums.length) return;
		busy.epics = true;
		const g = gen;
		try {
			const r = await gql(qEpics(nums));
			if (g !== gen) return;
			const next = new Map<number, EpicDetail>();
			for (const n of nums) {
				const node = r[`e${n}`];
				if (!node?.subIssues) continue;
				const epic = parseIssue(node);
				// biome-ignore lint: GraphQL node shape
				const children = node.subIssues.nodes.map((c: any) => ({ ...parseIssue(c), parent: n }));
				next.set(n, { epic, children, partial: node.subIssues.totalCount > children.length, summary: `${epic.subDone}/${epic.subTotal}` });
			}
			epicDetail = next;
			epicsWanted = false;
			ghOk("epics");
		} catch (e) {
			ghFailed("epics", e);
		} finally {
			lastEpics = Date.now();
			if (g === gen) busy.epics = false;
		}
	}

	// ---- view ----

	function rebuild() {
		const byNum = new Map<number, Issue>();
		for (const i of openIssues) byNum.set(i.number, i);
		const epics = epicNumbers();
		for (const e of epics) {
			const d = epicDetail.get(e);
			if (!d) continue;
			for (const c of d.children) if (!byNum.has(c.number) || c.state === "CLOSED") byNum.set(c.number, { ...byNum.get(c.number), ...c });
			const ep = byNum.get(e) ?? d.epic;
			byNum.set(e, { ...ep, subIssues: d.children.map((c) => c.number), partial: d.partial });
		}
		const notes: string[] = [];
		for (const [name, s] of Object.entries(sources)) {
			if (s.ok === false) notes.push(s.at ? `${name} stale ${Math.round((Date.now() - s.at) / 60000)}m: ${s.error}` : `${name}: ${s.error}`);
		}
		const paseoBlind = !!process.env.PASEO_AGENT_ID && !hosts.paseo;
		if (paseoBlind) notes.push("paseo: no cli, workers not shown");
		// Q1 must be fresh; Q2 too whenever an epic is shown
		const github = sources.github?.ok === true && epics.every((e) => epicDetail.has(e)) && (!epics.length || sources.epics?.ok === true);
		const applicable = ["git", ...(hosts.hc ? ["hc"] : []), ...(hosts.paseo ? ["paseo"] : []), ...(process.env.BB_THREAD_ID ? ["bb"] : [])];
		const hostsOk = applicable.every((h) => sources[h]?.ok !== false);
		const workersKnown = !paseoBlind && applicable.every((h) => sources[h]?.at !== undefined);
		const loading = !sources.github;
		view = buildView({
			issues: [...byNum.values()],
			workers,
			health: { github, hosts: hostsOk, workersKnown },
			partial: partialOpen,
			epics: epics.filter((e) => byNum.has(e)),
			pinned: [...runIssues],
			notes: loading ? ["loading…", ...notes] : notes,
		});
		render();
	}

	const styler = (theme: Theme): Style => (kind, s) => theme.fg(kind, s);

	function render() {
		for (const l of listeners) l();
		if (!ctx?.hasUI) return;
		if (!active || !view) {
			ctx.ui.setWidget(KEY, undefined);
			return;
		}
		const v = view;
		ctx.ui.setWidget(KEY, (_tui, theme) => ({
			render: (width: number) => widgetLines(v, styler(theme)).map((l) => truncateToWidth(l, width)),
			invalidate: () => {},
		}));
	}

	async function tick(force = false) {
		if (!active) return;
		const now = Date.now();
		const work: Promise<void>[] = [refreshHosts()];
		if (now < backoffUntil) {
			// rate limited: hosts only
		} else if (force || now - lastGithub >= GITHUB_MS) work.push(refreshGithub());
		else if (epicsWanted && now - lastEpics >= EPIC_DEBOUNCE_MS) work.push(refreshEpics());
		const g = gen;
		await Promise.allSettled(work);
		if (active && g === gen) rebuild();
	}

	async function start() {
		if (active) return;
		active = true;
		gen++;
		const g = gen;
		abort = new AbortController(); // fresh generation before any exec; the old one stays aborted
		busy = { gh: false, hosts: false, epics: false };
		hosts = { hc: await has("hc"), paseo: await has("paseo") };
		if (!active || g !== gen) return;
		void tick(true);
		timer = setInterval(() => void tick(), HOST_MS);
	}

	function stop() {
		active = false;
		gen++;
		abort.abort();
		abort = new AbortController(); // later execs (e.g. /factory-status on) must not inherit the aborted signal
		if (timer) clearInterval(timer);
		timer = undefined;
		ctx?.ui.setWidget(KEY, undefined);
	}

	async function decide() {
		if (!ctx || ctx.mode !== "tui") return;
		let decision = false;
		try {
			const out = (await exec("git", ["rev-parse", "--path-format=absolute", "--show-toplevel", "--git-dir", "--git-common-dir"])).trim().split("\n");
			root = out[0];
			const hasProfile = (await exec("sh", ["-c", 'test -f .foreman/profile && echo y || echo n'])).trim() === "y";
			decision = activationDecision({ hasProfile, linkedWorktree: out[1] !== out[2], sessionName: ctx.sessionManager.getSessionName() });
		} catch {
			decision = false;
		}
		if (forced !== undefined) decision = forced;
		if (decision && !active) await start();
		else if (!decision && active) stop();
	}

	// ---- events ----

	pi.on("session_start", async (_e, c) => {
		ctx = c;
		await decide();
	});
	pi.on("session_shutdown", async () => {
		stop();
		ctx = undefined;
	});
	pi.on("agent_end", async () => {
		// Foreman just processed something: refresh workers now, epic detail at most every EPIC_DEBOUNCE_MS.
		epicsWanted = true;
		if (active) void tick();
	});
	pi.on("input", async (e) => {
		const nums = runIssueNumbers(e.text);
		if (nums) for (const n of nums) runIssues.add(n);
		return { action: "continue" };
	});

	pi.registerCommand("factory-status", {
		description: "Foreman status: overlay of the plan; on | off | refresh | epic <n|auto>",
		handler: async (args, c) => {
			if (c.mode !== "tui") {
				c.ui.notify("/factory-status needs the interactive TUI", "warning");
				return;
			}
			ctx = c;
			const [cmd, arg] = args.trim().split(/\s+/);
			if (cmd === "on" || cmd === "off") {
				forced = cmd === "on";
				if (forced && !root) {
					try {
						root = (await exec("git", ["rev-parse", "--show-toplevel"])).trim();
					} catch {
						root = c.cwd;
					}
				}
				if (forced && !active) await start();
				else if (!forced) stop();
				c.ui.notify(`factory-status ${cmd}`, "info");
				return;
			}
			if (!active) {
				c.ui.notify("factory-status is off here (not a Foreman checkout, or a worker). Use /factory-status on.", "warning");
				return;
			}
			if (cmd === "refresh") {
				epicsWanted = true;
				await tick(true);
				return;
			}
			if (cmd === "epic") {
				pinnedEpic = arg && arg !== "auto" ? Number(arg.replace("#", "")) || undefined : undefined;
				epicsWanted = true;
				await tick(true);
				return;
			}
			epicsWanted = true;
			void tick(true);
			await c.ui.custom<void>(
				(tui, theme, _kb, done) => {
					let scroll = 0;
					const onChange = () => tui.requestRender();
					listeners.add(onChange);
					const height = () => Math.max(5, Math.floor(tui.terminal.rows * 0.85) - 6);
					return {
						render(width: number) {
							const st = styler(theme);
							const body = view ? planLines(view, st) : ["loading…"];
							const h = height();
							scroll = Math.max(0, Math.min(scroll, body.length - h));
							const shown = body.slice(scroll, scroll + h);
							const footer = theme.fg("dim", `↑↓ PgUp/PgDn scroll · r refresh · esc close · rows ${scroll + 1}-${scroll + shown.length}/${body.length}`);
							// opaque box: pad every row to full width so the chat behind does not show through
							const inner = Math.max(10, width - 4);
							const row = (l: string) => `${theme.fg("border", "│")} ${truncateToWidth(l, inner, "…", true)} ${theme.fg("border", "│")}`;
							const bar = (a: string, b: string) => theme.fg("border", `${a}${"─".repeat(width - 2)}${b}`);
							return [bar("╭", "╮"), row(theme.fg("accent", "Foreman status")), row(""), ...shown.map(row), row(""), row(footer), bar("╰", "╯")];
						},
						handleInput(data: string) {
							const h = height();
							if (matchesKey(data, "escape") || data === "q") {
								listeners.delete(onChange);
								done();
								return;
							}
							if (matchesKey(data, "up")) scroll--;
							else if (matchesKey(data, "down")) scroll++;
							else if (matchesKey(data, "pageUp")) scroll -= h;
							else if (matchesKey(data, "pageDown")) scroll += h;
							else if (data === "r") {
								epicsWanted = true;
								void tick(true);
							} else return;
							scroll = Math.max(0, scroll);
							tui.requestRender();
						},
						invalidate() {},
					};
				},
				{ overlay: true, overlayOptions: { width: "90%", maxHeight: "90%" } },
			);
		},
	});
}
