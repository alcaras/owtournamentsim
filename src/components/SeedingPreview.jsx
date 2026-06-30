// Seeding preview & helper tool.
//
// Paste the registration list straight off the per-ankh tournament page and
// this reproduces the seeding per-ankh will use (sign-up order = seed) plus the
// Round 1 Swiss fold pairings — the same algorithm the simulator runs.
//
// Optionally paste conservative (Glicko cons) ratings to unlock two seeding
// helpers, ported verbatim from the per-ankh `feat/glicko-cons` branch
// (commit 1d14ab2, "seed a division by cons + randomize the unrated"):
//   • Sort by cons — order each division by cons desc; unrated keep relative
//     order and sink to the bottom.
//   • Randomize unrated — Fisher–Yates shuffle of only the unrated slots,
//     leaving rated players in place.
//
// per-ankh seeds players in sign-up order, so "seeding" is literally the order
// rows appear. The only judgement call is parsing names out of cells that also
// carry timezone notes; the *order* is always authoritative even if a name is
// clipped oddly.

import React, { useEffect, useMemo, useState } from "react";
import { pairSwissRound } from "../engine/pairing.js";
import { CONFIG } from "../data/players.js";

const SAMPLE = `The New World (Americas)
1\tNinjaa\t✓
2\tSiontific\t✓
3\tAuro Central Time, yes open\t✓
4\talcaras Pacific (UTC-7)\t✓
5\tSabertooth\t✓
6\tNicknight EST\t✓
7\tThePurpleBullMoose\t✓
8\tkerstad UTC-5, yes I can play in alt division\t✓
9\tfiddlers25 utc-4 yes\t✓
10\tzophister UTC -7. Would prefer to play in division.\t✓
11\tMongrelEyes est. yes will play in other division\t✓
12\tHazardBringsAxe MTS. Sure I can play at any hour\t✓
13\tDrunkenMeister\t✓
14\tMagnus UTC-5\t✓
15\tprofessorcurly UTC-4\t✓
16\tJCT UTC-4\t✓
17\tShaunMcNamee UTC-5, no\t✓
18\tGodlovesus UTC-5/EST Yes\t✓
19\tA_Modern_Major_General UTC -7\t✓
20\tCorset Moosifer Lebelle PST west coast of Canada\t✓
21\tasteres -7\t✓
22\tcalitiso MST; UTC-6. and yes (:\t✓
23\tant PDT\t✓
24\tScrubinski -7\t✓
25\twatchtheturd CST. Yes.\t✓
26\t🐦🐦ĐØɄ฿ⱠɆ₵ØⱤVłĐ🐦🐦 UTC-4\t✓
27\tnobody Pacific Standard Time (UTC-8)\t✓
28\tOrion. UTC−06:00 (Central Time Zone).\t✓
29\tAuxArmes UTC -4. Would rather not play by European time\t✓
The Old World (Europe, Africa, Asia, Oceania)
1\tKlass_Koala UTC +3; like to play in evenings/nights\t✓
2\tAran UTC+2\t✓
3\tproblemgambler +2\t✓
4\tSpider UTC+2\t✓
5\tfluffybunny UTC+1\t✓
6\tBoldus UTC+2\t✓
7\tNestorLN UTC+2\t✓
8\tMoroten Utc+2\t✓
9\tKonstant UTC+3.\t✓
10\tMax (3WordName) UTC + 1, yes\t✓
11\tNapalmikoira UTC+3, can play in The New World (Americas) also\t✓
12\tMarauder Utc+2\t✓
13\tCLIFF123 Timezone is GMT\t✓
14\tMichael of Minsk\t✓
15\tIlyaGurkov GMT+3\t✓
16\tsolutodka. UTC+8 until July 19th\t✓
17\tImpognagrift My time zone is UTC+1.\t✓
18\tphielp UTC+2\t✓
19\ttjumma UTC +3\t✓
20\tJel UTC+2\t✓
21\tteuzet.\t✓
22\tbeefy BST (UTC+1). I can play in another division.\t✓
23\tchloriss UTC+3, open to play in any division if needed\t✓
24\tEgotheist UTC +2\t✓
25\tAkuukis UTC+3\t✓
26\tQuetzal UTC +3\t✓
27\tjonyjonas UTC+1, yes\t✓
28\tTurius UTC+2. Prefer my division\t✓
29\tGaz\t✓
30\tLerrike EEST (UTC+3 currently) Yes, but only as last resort.\t✓
31\theitlinger96 1/UTC+2 2/Yes\t✓`;

// Timezone / availability keywords that mark the start of a note inside a name
// cell. We cut the name at the first one so multi-word handles survive.
const NOTE_RX =
	/\b(UTC|GMT|BST|EST|EDT|CST|CDT|MST|MDT|PST|PDT|EEST|MTS|PT|ET|CT|MT|Pacific|Mountain|Central|Eastern|Standard|Timezone|Time)\b|[−+\-]\s*\d|[;,]|\bI\b|\byes\b|\bno\b/i;

function cleanName(raw) {
	let s = raw.replace(/✓/g, " ").trim(); // strip ✓
	s = s.split(/\t|\s{2,}/)[0].trim(); // cut at column separators
	const m = s.match(NOTE_RX); // cut at the first note keyword
	if (m && m.index > 0) s = s.slice(0, m.index).trim();
	return s.replace(/[.,;]+$/, "").trim() || raw.trim();
}

const norm = (s) =>
	s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]/g, "");

// Parse pasted registration text into { A: [names], B: [names] }.
// Division is chosen by the most recent "New World" / "Old World" header line.
// A row counts as a player iff it starts with a number.
function parseRoster(text) {
	const A = [];
	const B = [];
	let div = "A";
	for (const line of text.split(/\r?\n/)) {
		const t = line.trim();
		if (!t) continue;
		const lower = t.toLowerCase();
		const isRow = /^\d+[\s.\t)]/.test(t) || /^\d+$/.test(t);
		if (!isRow && lower.includes("new world")) {
			div = "A";
			continue;
		}
		if (!isRow && lower.includes("old world")) {
			div = "B";
			continue;
		}
		if (!isRow) continue; // header junk: "Player", "Claimed", "#", etc.
		const rest = t.replace(/^\d+[\s.\t)]+/, "").trim();
		const name = cleanName(rest);
		if (name) (div === "A" ? A : B).push(name);
	}
	return { A, B };
}

// Parse pasted cons ratings into a normalized-name → cons lookup. Accepts:
//   • owglick ratings.json (object with .ratings, or a bare array) where each
//     entry has {label|name, conservative|cons, registered?, games?}, or
//   • plain lines "Name<tab|comma|2+ spaces>1234".
// When two source entries normalize to the same key, prefer registered, then
// more games, then higher cons — same precedence as the analysis script.
function parseCons(text) {
	const trimmed = text.trim();
	if (!trimmed) return { map: new Map(), count: 0, error: null };

	let entries = [];
	try {
		if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
			const j = JSON.parse(trimmed);
			const arr = Array.isArray(j) ? j : j.ratings;
			if (!Array.isArray(arr)) throw new Error("no ratings array");
			entries = arr.map((e) => ({
				label: e.label ?? e.name ?? "",
				cons: e.conservative ?? e.cons,
				registered: !!e.registered,
				games: e.games ?? 0,
				aliases: Array.isArray(e.aliases) ? e.aliases : [],
			}));
		} else {
			for (const line of trimmed.split(/\r?\n/)) {
				const m = line.match(/^(.*?)[\t,]\s*(-?\d+(?:\.\d+)?)\s*$/) ||
					line.match(/^(.*\S)\s{2,}(-?\d+(?:\.\d+)?)\s*$/);
				if (!m) continue;
				entries.push({
					label: m[1].trim(),
					cons: parseFloat(m[2]),
					registered: false,
					games: 0,
				});
			}
		}
	} catch (err) {
		return { map: new Map(), count: 0, error: `Couldn't parse ratings: ${err.message}` };
	}

	const map = new Map();
	const valid = entries.filter(
		(e) => e.label && typeof e.cons === "number" && !Number.isNaN(e.cons),
	);
	// Pass 1: label-based keys, with registered/games precedence on collisions.
	for (const e of valid) {
		for (const k of new Set([norm(e.label), norm(e.label.split(/[ (]/)[0])])) {
			if (!k) continue;
			const cur = map.get(k);
			const better =
				!cur ||
				(e.registered && !cur.registered) ||
				(e.registered === cur.registered && e.games > cur.games);
			if (better) map.set(k, e);
		}
	}
	// Pass 2: explicit per-entry aliases win — map each alias to its entry.
	for (const e of valid) {
		for (const a of e.aliases) {
			for (const k of new Set([norm(a), norm(String(a).split(/[ (]/)[0])])) {
				if (k) map.set(k, e);
			}
		}
	}
	return { map, count: valid.length, error: null };
}

// Parse optional alias lines mapping a roster name to a ratings label, e.g.
//   Spider = frederik
//   CLIFF123 == cliff
// Returns Map(norm(rosterName) → ratingLabel string).
function parseAliases(text) {
	const map = new Map();
	for (const line of text.split(/\r?\n/)) {
		const m = line.match(/^(.+?)\s*={1,2}\s*(.+?)\s*$/);
		if (!m) continue;
		const from = norm(m[1]);
		if (from) map.set(from, m[2].trim());
	}
	return map;
}

function consFor(name, consMap, aliasMap) {
	// Explicit alias wins: resolve the roster name to a ratings label first.
	const target =
		aliasMap?.get(norm(name)) || aliasMap?.get(norm(name.split(/[ (]/)[0]));
	const lookup = target ?? name;
	const e =
		consMap.get(norm(lookup)) || consMap.get(norm(lookup.split(/[ (]/)[0]));
	return e ? e.cons : null;
}

function buildSlots(order) {
	const slots = [];
	for (const division of ["A", "B"]) {
		(order[division] || []).forEach((p, i) => {
			slots.push({
				slot_id: `${division}-${i + 1}`,
				division,
				swiss_seed: i + 1,
				name: p.name,
				cons: p.cons,
			});
		});
	}
	return slots;
}

// ---- the two helpers, ported verbatim from per-ankh feat/glicko-cons ----

// Order a division by cons desc; unrated (cons == null) keep relative order and
// sink below the rated ones. Array.sort is stable in modern engines, so the
// `return 0` for two unrated preserves their input order.
function sortByCons(arr) {
	return [...arr].sort((a, b) => {
		if (a.cons == null && b.cons == null) return 0;
		if (a.cons == null) return 1;
		if (b.cons == null) return -1;
		return b.cons - a.cons;
	});
}

// Fisher–Yates over only the unrated slots, leaving rated slots in place.
function randomizeUnrated(arr) {
	const positions = arr
		.map((s, i) => (s.cons == null ? i : -1))
		.filter((i) => i >= 0);
	const picked = positions.map((i) => arr[i]);
	for (let i = picked.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[picked[i], picked[j]] = [picked[j], picked[i]];
	}
	const out = [...arr];
	positions.forEach((pos, k) => (out[pos] = picked[k]));
	return out;
}

const DIV_LABEL = {
	A: "The New World — Americas",
	B: "The Old World — Europe, Africa, Asia, Oceania",
};

// Diff the working order against the sign-up order, per division. Returns the
// players whose seed changed (old → new), sorted by their new seed — i.e. the
// exact reorder to reproduce on the per-ankh site.
function computeChanges(base, order) {
	const out = {};
	let total = 0;
	for (const div of ["A", "B"]) {
		const oldSeed = new Map(base[div].map((p, i) => [p.name, i + 1]));
		const moved = [];
		order[div].forEach((p, i) => {
			const from = oldSeed.get(p.name);
			const to = i + 1;
			if (from !== to) moved.push({ name: p.name, from, to, cons: p.cons });
		});
		out[div] = moved;
		total += moved.length;
	}
	return { ...out, total };
}

function ChangeTable({ base, order }) {
	const changes = useMemo(() => computeChanges(base, order), [base, order]);
	if (changes.total === 0) return null;

	return (
		<div className="bg-gray-deep rounded-xl p-3 border border-orange/40">
			<div className="flex items-baseline justify-between mb-2">
				<h3 className="font-bold text-orange">What to change on per-ankh</h3>
				<span className="text-xs text-muted">
					{changes.total} player{changes.total === 1 ? "" : "s"} move
				</span>
			</div>
			<p className="text-[11px] text-muted mb-2">
				Each row is a player whose seed changed vs sign-up order. On per-ankh,
				drag each player to their <span className="text-tan">New</span> seed
				(rows are listed in new-seed order, so applying top-to-bottom
				reproduces the result).
			</p>
			<div className="grid grid-cols-1 lg:grid-cols-2 gap-x-4 gap-y-3">
				{["A", "B"].map((div) =>
					changes[div].length === 0 ? null : (
						<div key={div}>
							<div
								className={`text-[11px] uppercase tracking-wider mb-1 ${div === "A" ? "text-newworld" : "text-oldworld"}`}
							>
								{DIV_LABEL[div]}
							</div>
							<table className="w-full text-sm">
								<thead>
									<tr className="text-[11px] text-muted uppercase tracking-wider">
										<th className="text-left font-normal w-12">New</th>
										<th className="text-left font-normal w-12">Was</th>
										<th className="text-left font-normal">Player</th>
										<th className="text-right font-normal w-12">Move</th>
									</tr>
								</thead>
								<tbody>
									{changes[div].map((c) => {
										const up = c.to < c.from; // lower seed number = moved up
										return (
											<tr key={c.name} className="border-t border-border-subtle/50">
												<td className="tabular-nums text-tan font-semibold">
													#{c.to}
												</td>
												<td className="tabular-nums text-muted">#{c.from}</td>
												<td className="text-bright truncate">{c.name}</td>
												<td
													className={`text-right tabular-nums ${up ? "text-newworld" : "text-orange"}`}
												>
													{up ? "▲" : "▼"}
													{Math.abs(c.to - c.from)}
												</td>
											</tr>
										);
									})}
								</tbody>
							</table>
						</div>
					),
				)}
			</div>
		</div>
	);
}

function DivisionCard({ division, players, slots, hasCons }) {
	if (!players.length) return null;
	const divSlots = slots.filter((s) => s.division === division);
	const byId = new Map(divSlots.map((s) => [s.slot_id, s]));
	const pairings = pairSwissRound(divSlots, [], 1, CONFIG);

	const seedOf = (id) => byId.get(id)?.swiss_seed ?? "?";
	const nameOf = (id) => byId.get(id)?.name ?? "—";
	const color = division === "A" ? "text-newworld" : "text-oldworld";

	const copyOrder = () => {
		const txt = players.map((p) => p.name).join("\n");
		navigator.clipboard?.writeText(txt);
	};

	return (
		<div className="bg-gray-deep rounded-xl p-3 border border-border-subtle">
			<div className="flex items-baseline justify-between mb-2">
				<h3 className={`font-bold ${color}`}>{DIV_LABEL[division]}</h3>
				<button
					onClick={copyOrder}
					className="text-[11px] text-muted hover:text-orange underline"
					title="Copy the current seed order (one name per line)"
				>
					copy order · {players.length} players
				</button>
			</div>

			<div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
				{/* Seeding */}
				<div>
					<div className="text-[11px] uppercase tracking-wider text-muted mb-1">
						Seeding (sign-up order)
					</div>
					<ol className="text-sm space-y-0.5">
						{players.map((p, i) => (
							<li key={i} className="flex gap-2 items-baseline">
								<span className="text-tan tabular-nums w-6 text-right">
									{i + 1}
								</span>
								<span className="text-bright truncate flex-1">{p.name}</span>
								{hasCons && (
									<span
										className={`tabular-nums text-xs ${p.cons == null ? "text-muted/50" : "text-muted"}`}
									>
										{p.cons == null ? "—" : Math.round(p.cons)}
									</span>
								)}
							</li>
						))}
					</ol>
				</div>

				{/* Round 1 pairings */}
				<div className="mt-3 sm:mt-0">
					<div className="text-[11px] uppercase tracking-wider text-muted mb-1">
						Round 1 pairings (seed fold)
					</div>
					<ul className="text-sm space-y-0.5">
						{pairings.map((p, i) => {
							if (p.slot_b_id === null) {
								return (
									<li key={i} className="text-orange">
										<span className="tabular-nums">#{seedOf(p.slot_a_id)}</span>{" "}
										{nameOf(p.slot_a_id)} — <em>bye</em>
									</li>
								);
							}
							return (
								<li key={i} className="text-bright">
									<span className="tabular-nums text-tan">
										#{seedOf(p.slot_a_id)}
									</span>{" "}
									{nameOf(p.slot_a_id)} <span className="text-muted">vs</span>{" "}
									<span className="tabular-nums text-tan">
										#{seedOf(p.slot_b_id)}
									</span>{" "}
									{nameOf(p.slot_b_id)}
								</li>
							);
						})}
					</ul>
				</div>
			</div>
		</div>
	);
}

// "Do these two meet in Round 1?" checker.
function MatchupChecker({ slots }) {
	const [a, setA] = useState("");
	const [b, setB] = useState("");

	const result = useMemo(() => {
		if (!a.trim() || !b.trim()) return null;
		const find = (q) =>
			slots.find((s) => s.name.toLowerCase().includes(q.trim().toLowerCase()));
		const sa = find(a);
		const sb = find(b);
		if (!sa) return { error: `No player matching "${a}".` };
		if (!sb) return { error: `No player matching "${b}".` };
		if (sa.slot_id === sb.slot_id) return { error: "That's the same player." };
		if (sa.division !== sb.division)
			return {
				ok: false,
				sa,
				sb,
				reason:
					"They're in different divisions, so they can't meet in Swiss at all (only in the cross-division championship bracket).",
			};

		const divSlots = slots.filter((s) => s.division === sa.division);
		const pairings = pairSwissRound(divSlots, [], 1, CONFIG);
		const meets = pairings.some(
			(p) =>
				(p.slot_a_id === sa.slot_id && p.slot_b_id === sb.slot_id) ||
				(p.slot_a_id === sb.slot_id && p.slot_b_id === sa.slot_id),
		);
		const oppOf = (id) => {
			for (const p of pairings) {
				if (p.slot_a_id === id) return p.slot_b_id === null ? null : p.slot_b_id;
				if (p.slot_b_id === id) return p.slot_a_id;
			}
			return undefined;
		};
		const nameOf = (id) =>
			id === null
				? "a bye"
				: (divSlots.find((s) => s.slot_id === id)?.name ?? "?");
		const seedOf = (id) =>
			divSlots.find((s) => s.slot_id === id)?.swiss_seed ?? "?";

		const n = divSlots.length;
		const playing = n % 2 === 0 ? n : n - 1; // field after the bye
		const half = playing / 2;
		const sSeed = sa.swiss_seed;
		let targetSeed = null;
		if (sSeed <= half) targetSeed = sSeed + half;
		else if (sSeed <= playing) targetSeed = sSeed - half;

		return {
			ok: meets,
			sa,
			sb,
			aOpp: oppOf(sa.slot_id),
			bOpp: oppOf(sb.slot_id),
			nameOf,
			seedOf,
			targetSeed,
			playing,
		};
	}, [a, b, slots]);

	return (
		<div className="bg-gray-deep rounded-xl p-3 border border-border-subtle">
			<div className="text-[11px] uppercase tracking-wider text-muted mb-2">
				Will two players meet in Round 1?
			</div>
			<div className="flex flex-wrap gap-2 mb-2">
				<input
					value={a}
					onChange={(e) => setA(e.target.value)}
					placeholder="Player A (e.g. Siontific)"
					className="flex-1 min-w-[160px] bg-gray-raised rounded-lg px-2 py-1.5 text-sm border border-border-subtle focus:border-orange outline-none"
				/>
				<input
					value={b}
					onChange={(e) => setB(e.target.value)}
					placeholder="Player B (e.g. Magnus)"
					className="flex-1 min-w-[160px] bg-gray-raised rounded-lg px-2 py-1.5 text-sm border border-border-subtle focus:border-orange outline-none"
				/>
			</div>
			{result?.error && <p className="text-sm text-muted">{result.error}</p>}
			{result && !result.error && (
				<div className="text-sm space-y-1">
					{result.ok ? (
						<p className="text-newworld font-semibold">
							✓ Yes — {result.sa.name} (#{result.sa.swiss_seed}) plays{" "}
							{result.sb.name} (#{result.sb.swiss_seed}) in Round 1.
						</p>
					) : (
						<>
							<p className="text-orange font-semibold">
								✗ No — they don't meet in Round 1.
							</p>
							{result.reason ? (
								<p className="text-muted">{result.reason}</p>
							) : (
								<>
									<p className="text-muted">
										{result.sa.name} (#{result.sa.swiss_seed}) plays{" "}
										{result.nameOf(result.aOpp)}
										{result.aOpp !== null &&
											` (#${result.seedOf(result.aOpp)})`}
										. {result.sb.name} (#{result.sb.swiss_seed}) plays{" "}
										{result.nameOf(result.bOpp)}
										{result.bOpp !== null &&
											` (#${result.seedOf(result.bOpp)})`}
										.
									</p>
									{result.targetSeed && (
										<p className="text-tan">
											To pair them: keep {result.sa.name} at seed #
											{result.sa.swiss_seed} and move {result.sb.name} to seed #
											{result.targetSeed} (currently seed #
											{result.sb.swiss_seed}). Fold pairing pairs seed{" "}
											<em>s</em> with seed <em>s ± {result.playing / 2}</em>.
										</p>
									)}
								</>
							)}
						</>
					)}
				</div>
			)}
		</div>
	);
}

export function SeedingPreview() {
	const [text, setText] = useState(SAMPLE);
	const [consText, setConsText] = useState("");
	const [aliasText, setAliasText] = useState("");
	const [showCons, setShowCons] = useState(false);

	const rosterNames = useMemo(() => parseRoster(text), [text]);
	const { map: consMap, count: consCount, error: consError } = useMemo(
		() => parseCons(consText),
		[consText],
	);
	const aliasMap = useMemo(() => parseAliases(aliasText), [aliasText]);
	const hasCons = consCount > 0;

	// Base order straight from the paste, with cons attached. The working
	// `order` starts here and is mutated by the helper buttons; it resets
	// whenever the registration or ratings inputs change.
	const baseOrder = useMemo(() => {
		const attach = (names) =>
			names.map((name) => ({ name, cons: consFor(name, consMap, aliasMap) }));
		return { A: attach(rosterNames.A), B: attach(rosterNames.B) };
	}, [rosterNames, consMap, aliasMap]);

	const [order, setOrder] = useState(baseOrder);
	useEffect(() => setOrder(baseOrder), [baseOrder]);

	const slots = useMemo(() => buildSlots(order), [order]);

	const applyBoth = (fn) =>
		setOrder((o) => ({ A: fn(o.A), B: fn(o.B) }));

	return (
		<div className="space-y-3">
			<div className="bg-gray-deep rounded-xl p-3 border border-border-subtle">
				<label className="text-[11px] uppercase tracking-wider text-muted mb-1 block">
					Paste the registration list from the tournament page
				</label>
				<textarea
					value={text}
					onChange={(e) => setText(e.target.value)}
					rows={7}
					spellCheck={false}
					className="w-full bg-gray-raised rounded-lg p-2 text-xs font-mono border border-border-subtle focus:border-orange outline-none"
				/>
				<p className="text-[11px] text-muted mt-1">
					Seed = sign-up order. Names are parsed best-effort (timezone notes
					stripped); the <em>order</em> is what determines pairings. Use the
					division headers (&ldquo;New World&rdquo; / &ldquo;Old World&rdquo;) to
					split — without them everything lands in The New World.
				</p>

				{/* Cons ratings + helpers */}
				<div className="mt-3 pt-3 border-t border-border-subtle">
					<button
						onClick={() => setShowCons((v) => !v)}
						className="text-[11px] uppercase tracking-wider text-muted hover:text-orange"
					>
						{showCons ? "▾" : "▸"} Seeding helpers (paste cons ratings)
						{hasCons ? ` · ${consCount} loaded` : ""}
					</button>
					{showCons && (
						<div className="mt-2">
							<textarea
								value={consText}
								onChange={(e) => setConsText(e.target.value)}
								rows={4}
								spellCheck={false}
								placeholder={
									'Paste owglick ratings.json, or lines like:\nAran, 1809\nSiontific\t1487'
								}
								className="w-full bg-gray-raised rounded-lg p-2 text-xs font-mono border border-border-subtle focus:border-orange outline-none"
							/>
							{consError && (
								<p className="text-[11px] text-orange mt-1">{consError}</p>
							)}
							<label className="text-[11px] uppercase tracking-wider text-muted mt-2 mb-1 block">
								Aliases (optional) — map a roster name to a ratings handle
							</label>
							<textarea
								value={aliasText}
								onChange={(e) => setAliasText(e.target.value)}
								rows={2}
								spellCheck={false}
								placeholder={"Spider = frederik\nCLIFF123 = cliff"}
								className="w-full bg-gray-raised rounded-lg p-2 text-xs font-mono border border-border-subtle focus:border-orange outline-none"
							/>
							{aliasMap.size > 0 && (
								<p className="text-[11px] text-muted mt-1">
									{aliasMap.size} alias{aliasMap.size === 1 ? "" : "es"} applied.
								</p>
							)}
							<div className="flex flex-wrap items-center gap-2 mt-2">
								<span className="text-xs text-muted">Seed:</span>
								<button
									onClick={() => applyBoth(sortByCons)}
									disabled={!hasCons}
									title="Order each division by conservative rating, highest first. Unrated players sink to the bottom."
									className="rounded border border-tan px-2.5 py-1 text-xs text-tan hover:border-orange hover:text-orange disabled:opacity-40 disabled:cursor-not-allowed"
								>
									Sort by cons
								</button>
								<button
									onClick={() => applyBoth(randomizeUnrated)}
									disabled={!hasCons}
									title="Randomly shuffle the seeds of players with no rating, leaving rated players in place."
									className="rounded border border-tan px-2.5 py-1 text-xs text-tan hover:border-orange hover:text-orange disabled:opacity-40 disabled:cursor-not-allowed"
								>
									Randomize unrated
								</button>
								<button
									onClick={() => setOrder(baseOrder)}
									title="Revert to sign-up order"
									className="rounded border border-border-subtle px-2.5 py-1 text-xs text-muted hover:text-bright"
								>
									Reset to sign-up
								</button>
							</div>
							<p className="text-[11px] text-muted mt-1">
								Ported from per-ankh&rsquo;s{" "}
								<code className="text-tan">feat/glicko-cons</code> branch. Sort
								is cons-descending with unrated sunk to the bottom; randomize is
								a Fisher–Yates over only the unrated tail. Use{" "}
								<em>copy order</em> on a division to paste the result back.
							</p>
						</div>
					)}
				</div>
			</div>

			<MatchupChecker slots={slots} />

			<ChangeTable base={baseOrder} order={order} />

			<div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
				<DivisionCard
					division="A"
					players={order.A}
					slots={slots}
					hasCons={hasCons}
				/>
				<DivisionCard
					division="B"
					players={order.B}
					slots={slots}
					hasCons={hasCons}
				/>
			</div>
		</div>
	);
}
