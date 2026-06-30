// Seeding preview tool.
//
// Paste the registration list straight off the per-ankh tournament page and
// this reproduces the seeding per-ankh will use (sign-up order = seed) plus the
// Round 1 Swiss fold pairings — the same algorithm the simulator runs.
//
// per-ankh seeds players in sign-up order, so "seeding" is literally the order
// rows appear. The only judgement call is parsing names out of cells that also
// carry timezone notes; the *order* is always authoritative even if a name is
// clipped oddly.

import React, { useMemo, useState } from "react";
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
	/\b(UTC|GMT|BST|EST|EDT|CST|CDT|MST|MDT|PST|PDT|PDT|EEST|MTS|PT|ET|CT|MT|Pacific|Mountain|Central|Eastern|Standard|Timezone|Time)\b|[−-]\s*\d|[;,]|\bI\b|\byes\b|\bno\b/i;

function cleanName(raw) {
	let s = raw.replace(/✓/g, " ").trim(); // strip ✓
	// Cut at a run of 2+ spaces or a tab (column separators).
	s = s.split(/\t|\s{2,}/)[0].trim();
	// Cut at the first note keyword.
	const m = s.match(NOTE_RX);
	if (m && m.index > 0) s = s.slice(0, m.index).trim();
	return s.replace(/[.,;]+$/, "").trim() || raw.trim();
}

// Parse pasted registration text into { A: [names], B: [names] }.
// Division is chosen by the most recent "New World" / "Old World" header line.
// A row counts as a player iff it starts with a number.
function parseRoster(text) {
	const A = [];
	const B = [];
	let div = "A";
	let seenAnyHeader = false;
	for (const line of text.split(/\r?\n/)) {
		const t = line.trim();
		if (!t) continue;
		const lower = t.toLowerCase();
		const isRow = /^\d+[\s.\t)]/.test(t) || /^\d+$/.test(t);
		if (!isRow && lower.includes("new world")) {
			div = "A";
			seenAnyHeader = true;
			continue;
		}
		if (!isRow && lower.includes("old world")) {
			div = "B";
			seenAnyHeader = true;
			continue;
		}
		if (!isRow) continue; // header junk: "Player", "Claimed", "#", etc.
		const rest = t.replace(/^\d+[\s.\t)]+/, "").trim();
		const name = cleanName(rest);
		if (!name) continue;
		(div === "A" ? A : B).push(name);
	}
	return { A, B, seenAnyHeader };
}

function buildSlots(roster) {
	const slots = [];
	for (const division of ["A", "B"]) {
		(roster[division] || []).forEach((name, i) => {
			slots.push({
				slot_id: `${division}-${i + 1}`,
				division,
				swiss_seed: i + 1,
				name,
			});
		});
	}
	return slots;
}

const DIV_LABEL = {
	A: "The New World — Americas",
	B: "The Old World — Europe, Africa, Asia, Oceania",
};

function DivisionCard({ division, names, slots }) {
	if (!names.length) return null;
	const divSlots = slots.filter((s) => s.division === division);
	const byId = new Map(divSlots.map((s) => [s.slot_id, s]));
	const pairings = pairSwissRound(divSlots, [], 1, CONFIG);

	const seedOf = (id) => byId.get(id)?.swiss_seed ?? "?";
	const nameOf = (id) => byId.get(id)?.name ?? "—";

	const color = division === "A" ? "text-newworld" : "text-oldworld";

	return (
		<div className="bg-gray-deep rounded-xl p-3 border border-border-subtle">
			<div className="flex items-baseline justify-between mb-2">
				<h3 className={`font-bold ${color}`}>{DIV_LABEL[division]}</h3>
				<span className="text-xs text-muted">{names.length} players</span>
			</div>

			<div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
				{/* Seeding */}
				<div>
					<div className="text-[11px] uppercase tracking-wider text-muted mb-1">
						Seeding (sign-up order)
					</div>
					<ol className="text-sm space-y-0.5">
						{names.map((n, i) => (
							<li key={i} className="flex gap-2">
								<span className="text-tan tabular-nums w-6 text-right">
									{i + 1}
								</span>
								<span className="text-bright truncate">{n}</span>
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
										<span className="tabular-nums">
											#{seedOf(p.slot_a_id)}
										</span>{" "}
										{nameOf(p.slot_a_id)} — <em>bye</em>
									</li>
								);
							}
							return (
								<li key={i} className="text-bright">
									<span className="tabular-nums text-tan">
										#{seedOf(p.slot_a_id)}
									</span>{" "}
									{nameOf(p.slot_a_id)}{" "}
									<span className="text-muted">vs</span>{" "}
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
				reason: "They're in different divisions, so they can't meet in Swiss at all (only in the cross-division championship bracket).",
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
				if (p.slot_a_id === id)
					return p.slot_b_id === null ? null : p.slot_b_id;
				if (p.slot_b_id === id) return p.slot_a_id;
			}
			return undefined;
		};
		const nameOf = (id) =>
			id === null ? "a bye" : (divSlots.find((s) => s.slot_id === id)?.name ?? "?");
		const seedOf = (id) =>
			divSlots.find((s) => s.slot_id === id)?.swiss_seed ?? "?";

		// What seed would the second player need to share a fold pair with the
		// first? (n players → seed n byes; partner of seed s is s±half.)
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
			{result?.error && (
				<p className="text-sm text-muted">{result.error}</p>
			)}
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
											{result.sa.swiss_seed} and move {result.sb.name} to
											seed #{result.targetSeed} (currently seed #
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
	const roster = useMemo(() => parseRoster(text), [text]);
	const slots = useMemo(() => buildSlots(roster), [roster]);

	return (
		<div className="space-y-3">
			<div className="bg-gray-deep rounded-xl p-3 border border-border-subtle">
				<label className="text-[11px] uppercase tracking-wider text-muted mb-1 block">
					Paste the registration list from the tournament page
				</label>
				<textarea
					value={text}
					onChange={(e) => setText(e.target.value)}
					rows={8}
					spellCheck={false}
					className="w-full bg-gray-raised rounded-lg p-2 text-xs font-mono border border-border-subtle focus:border-orange outline-none"
				/>
				<p className="text-[11px] text-muted mt-1">
					Seed = sign-up order. Names are parsed best-effort (timezone notes
					stripped); the <em>order</em> is what determines pairings. Use the
					division headers (&ldquo;New World&rdquo; / &ldquo;Old World&rdquo;) to
					split — without them everything lands in The New World.
				</p>
			</div>

			<MatchupChecker slots={slots} />

			<div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
				<DivisionCard division="A" names={roster.A} slots={slots} />
				<DivisionCard division="B" names={roster.B} slots={slots} />
			</div>
		</div>
	);
}
