import React, { memo } from "react";
import { Check, X } from "lucide-react";

const DIV_TONE = {
	A: { text: "text-newworld", dot: "bg-newworld", border: "border-newworld/30" },
	B: { text: "text-oldworld", dot: "bg-oldworld", border: "border-oldworld/30" },
};

// One division column: active / advanced / eliminated, with this round's
// results highlighted on each tile.
export const ZoneColumn = memo(function ZoneColumn({
	division,
	name,
	subtitle,
	groups,
	resultMap,
	oppMap,
	nameOf,
	seedOf,
	total,
	advanceCut,
	showCut,
	inChampionship,
}) {
	const c = DIV_TONE[division];
	return (
		<div className={`bg-gray-deep rounded-xl p-3 border ${c.border}`}>
			<div className="flex items-baseline justify-between mb-2">
				<h2 className={`text-sm font-bold ${c.text} uppercase tracking-wider flex items-center gap-1.5`}>
					<span className={`w-2 h-2 rounded-full ${c.dot}`}></span>
					{name}
				</h2>
				<span className="text-[11px] text-muted">{subtitle}</span>
			</div>
			<div className="text-[11px] text-muted mb-2">
				{total} players · 3 wins advance · 3 losses out
			</div>

			<Subsection title="Active" count={groups.active.length} color="text-tan">
				{groups.active.length === 0 ? (
					<div className="text-xs text-muted italic">All resolved</div>
				) : (
					<div className="grid grid-cols-2 sm:grid-cols-3 gap-1">
						{groups.active.map((e) => (
							<PlayerTile
								key={e.slot_id}
								entry={e}
								result={resultMap.get(e.slot_id)}
								opp={oppMap.get(e.slot_id)}
								nameOf={nameOf}
								seedOf={seedOf}
							/>
						))}
					</div>
				)}
			</Subsection>

			<Subsection
				title="Advanced"
				count={groups.advanced.length}
				color="text-success"
				icon={<Check className="w-3 h-3" />}
			>
				{groups.advanced.length === 0 ? (
					<div className="text-xs text-muted italic">—</div>
				) : (
					<div className="flex flex-wrap gap-1">
						{groups.advanced.map((e) => (
							<CompactTile
								key={e.slot_id}
								entry={e}
								type="advanced"
								nameOf={nameOf}
								seedOf={seedOf}
								highlight={showCut && inChampionship.has(e.slot_id)}
							/>
						))}
					</div>
				)}
			</Subsection>

			<Subsection
				title="Eliminated"
				count={groups.eliminated.length}
				color="text-danger"
				icon={<X className="w-3 h-3" />}
			>
				{groups.eliminated.length === 0 ? (
					<div className="text-xs text-muted italic">—</div>
				) : (
					<div className="flex flex-wrap gap-1">
						{groups.eliminated.map((e) => (
							<CompactTile
								key={e.slot_id}
								entry={e}
								type="eliminated"
								nameOf={nameOf}
								seedOf={seedOf}
							/>
						))}
					</div>
				)}
			</Subsection>
		</div>
	);
});

function Subsection({ title, count, color, icon, children }) {
	return (
		<div className="mb-2.5 last:mb-0">
			<div className={`flex items-center gap-1 text-xs uppercase tracking-wider font-semibold ${color} mb-1`}>
				{icon}
				<span>{title}</span>
				<span className="text-muted font-normal">({count})</span>
			</div>
			{children}
		</div>
	);
}

function tooltip(entry, nameOf, seedOf, opp) {
	return (
		`#${seedOf(entry.slot_id)} ${nameOf(entry.slot_id)} • ${entry.wins}-${entry.losses}` +
		(opp ? ` • vs ${nameOf(opp)}` : "") +
		` • Buch ${entry.buchholz_cut1} · OppBuch ${entry.opponents_buchholz} · Cum ${entry.cumulative}`
	);
}

function PlayerTile({ entry, result, opp, nameOf, seedOf }) {
	let cls = "bg-gray border-border-subtle text-bright";
	if (result === "won") cls = "bg-success-surface border-success/60 text-tan-light";
	else if (result === "lost") cls = "bg-danger-surface border-danger/60 text-tan-light";
	else if (result === "bye") cls = "bg-orange/20 border-orange/50 text-orange";
	return (
		<div
			className={`${cls} border rounded py-1 px-1.5 text-center overflow-hidden`}
			title={tooltip(entry, nameOf, seedOf, opp)}
		>
			<div className="text-xs font-bold leading-tight truncate">
				<span className="text-muted">{seedOf(entry.slot_id)} </span>
				{nameOf(entry.slot_id)}
			</div>
			<div className="text-[10px] opacity-75 leading-tight">
				{entry.wins}-{entry.losses}
				{result === "bye" && " · bye"}
			</div>
		</div>
	);
}

function CompactTile({ entry, type, nameOf, seedOf, highlight }) {
	let cls;
	if (highlight) cls = "bg-orange border-orange text-blue-gray font-semibold";
	else if (type === "advanced") cls = "bg-success-surface border-success/50 text-success";
	else cls = "bg-danger-surface/60 border-danger/40 text-danger/80";
	return (
		<span
			className={`${cls} border rounded px-1.5 py-0.5 text-[10px] font-medium whitespace-nowrap`}
			title={tooltip(entry, nameOf, seedOf)}
		>
			{highlight && "★ "}
			<span className="opacity-60">{seedOf(entry.slot_id)}</span> {nameOf(entry.slot_id)}{" "}
			<span className="opacity-60 font-normal">
				{entry.wins}-{entry.losses}
			</span>
		</span>
	);
}

// This round's pairings for both divisions.
export const PairingsPanel = memo(function PairingsPanel({
	step,
	roundA,
	roundB,
	names,
	nameOf,
}) {
	return (
		<div className="bg-gray-deep rounded-xl p-3 border border-border-subtle mb-3">
			<h2 className="text-sm font-semibold text-bright mb-2">
				Round {step} pairings
				<span className="text-xs text-muted font-normal ml-2">— same-record matchups</span>
			</h2>
			<div className="grid grid-cols-1 md:grid-cols-2 gap-3">
				<ZonePairings title={names.A} color="text-newworld" round={roundA} nameOf={nameOf} />
				<ZonePairings title={names.B} color="text-oldworld" round={roundB} nameOf={nameOf} />
			</div>
		</div>
	);
});

function ZonePairings({ title, color, round, nameOf }) {
	return (
		<div>
			<h3 className={`text-xs ${color} font-semibold mb-1.5 uppercase tracking-wider`}>{title}</h3>
			<div className="space-y-1">
				{!round && <div className="text-xs text-muted italic px-1">Division already resolved</div>}
				{round &&
					round.matches.map((m, i) =>
						m.slot_b_id === null ? (
							<div
								key={i}
								className="bg-orange/15 border border-orange/40 rounded p-1.5 text-center text-xs text-orange"
							>
								{nameOf(m.slot_a_id)} <span className="opacity-70">— bye (auto-win)</span>
							</div>
						) : (
							<MatchRow key={i} match={m} nameOf={nameOf} />
						),
					)}
				{round && round.matches.length === 0 && (
					<div className="text-xs text-muted italic px-1">No active matches this round</div>
				)}
			</div>
		</div>
	);
}

function MatchRow({ match, nameOf }) {
	const aWon = match.winner_slot_id === match.slot_a_id;
	return (
		<div className="bg-gray rounded-lg p-1 border border-border-subtle flex items-center gap-1 text-sm">
			<div className={`flex-1 text-center px-2 py-1 rounded truncate ${aWon ? "bg-success-surface text-tan-light font-semibold" : "text-muted"}`}>
				{nameOf(match.slot_a_id)}
			</div>
			<span className="text-muted text-xs px-0.5">vs</span>
			<div className={`flex-1 text-center px-2 py-1 rounded truncate ${!aWon ? "bg-success-surface text-tan-light font-semibold" : "text-muted"}`}>
				{nameOf(match.slot_b_id)}
			</div>
		</div>
	);
}
