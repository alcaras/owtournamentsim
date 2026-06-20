import React, { memo, useMemo } from "react";
import { Trophy, Crown } from "lucide-react";

const ROUND_LABELS = {
	1: "Final",
	2: "Semifinals",
	4: "Quarterfinals",
	8: "Round of 16",
	16: "Round of 32",
	32: "Round of 64",
};

function fitName(name, max = 14) {
	if (!name) return "—";
	return name.length > max ? name.slice(0, max - 1) + "…" : name;
}

// Single-elimination championship bracket (standard 1-vs-N seeding, R1 byes,
// no bronze match) — exactly per-ankh's structure.
export const BracketView = memo(function BracketView({
	championship,
	playedRounds, // how many rounds are revealed
	isComplete,
	champion,
	nameOf,
	divOf,
	champSeedOf,
}) {
	const rounds = championship.rounds;
	const numRounds = rounds.length;
	const matchHeight = 46;
	const matchWidth = 168;
	const hSpacing = 52;
	const vSpacing = 12;

	const layout = useMemo(() => {
		const positions = [];
		positions.push(
			rounds[0].map((m, i) => ({
				x: 10,
				y: i * (matchHeight + vSpacing) + 30,
				match: m,
			})),
		);
		for (let r = 1; r < rounds.length; r++) {
			const round = rounds[r].map((m, i) => {
				const p1 = positions[r - 1][i * 2];
				const p2 = positions[r - 1][i * 2 + 1];
				return {
					x: r * (matchWidth + hSpacing) + 10,
					y: (p1.y + p2.y) / 2,
					match: m,
				};
			});
			positions.push(round);
		}
		return positions;
	}, [rounds]);

	const firstCount = rounds[0].length;
	const totalHeight = firstCount * (matchHeight + vSpacing) + 40;
	const totalWidth = numRounds * (matchWidth + hSpacing) + 20;

	const stripe = (slot) =>
		!slot ? "#3a352f" : divOf(slot) === "A" ? "rgb(120 170 200)" : "rgb(210 150 90)";

	return (
		<div className="bg-gray-deep rounded-xl p-3 border border-border-subtle overflow-x-auto">
			<h2 className="text-sm font-semibold text-bright mb-2 flex items-center gap-2">
				<Trophy className="w-4 h-4 text-orange" />
				Championship — Top {championship.seedOrder.length} (bracket of {championship.bracketSize})
				<span className="text-xs text-muted font-normal ml-1">
					· combined cross-division seeding
				</span>
				<span className="ml-auto text-xs flex items-center gap-3">
					<span className="flex items-center gap-1 text-newworld">
						<span className="w-2 h-2 rounded-full bg-newworld"></span>New World
					</span>
					<span className="flex items-center gap-1 text-oldworld">
						<span className="w-2 h-2 rounded-full bg-oldworld"></span>Old World
					</span>
				</span>
			</h2>

			<svg width={totalWidth} height={totalHeight} className="block">
				{rounds.map((r, rIdx) => (
					<text
						key={rIdx}
						x={rIdx * (matchWidth + hSpacing) + 10 + matchWidth / 2}
						y={18}
						fill="rgb(122 106 85)"
						fontSize="11"
						textAnchor="middle"
						fontWeight="600"
					>
						{ROUND_LABELS[r.length] || `Round ${rIdx + 1}`}
					</text>
				))}

				{layout.slice(0, -1).map((round, rIdx) =>
					round.map((src, i) => {
						if (i % 2 !== 0) return null;
						const src2 = round[i + 1];
						const dest = layout[rIdx + 1][i / 2];
						if (!src2 || !dest) return null;
						const x1End = src.x + matchWidth;
						const y1Mid = src.y + matchHeight / 2;
						const y2Mid = src2.y + matchHeight / 2;
						const xMid = dest.x - hSpacing / 2;
						const yDest = dest.y + matchHeight / 2;
						return (
							<g key={`c-${rIdx}-${i}`} stroke="rgb(58 53 47)" strokeWidth="1.2" fill="none">
								<line x1={x1End} y1={y1Mid} x2={xMid} y2={y1Mid} />
								<line x1={x1End} y1={y2Mid} x2={xMid} y2={y2Mid} />
								<line x1={xMid} y1={y1Mid} x2={xMid} y2={y2Mid} />
								<line x1={xMid} y1={yDest} x2={dest.x} y2={yDest} />
							</g>
						);
					}),
				)}

				{layout.map((round, rIdx) =>
					round.map((mp, mIdx) => {
						const m = mp.match;
						const aWon = m.winner_slot_id === m.a_slot;
						const isPlayed = rIdx < playedRounds;
						// Participants of a round only appear once the feeding round
						// has been played (R1 is revealed as soon as the bracket is set).
						const revealed = rIdx <= playedRounds;
						const isFinal = rIdx === numRounds - 1 && isPlayed;
						return (
							<MatchBox
								key={`m-${rIdx}-${mIdx}`}
								m={m}
								x={mp.x}
								y={mp.y}
								aWon={aWon}
								isPlayed={isPlayed}
								revealed={revealed}
								isFinal={isFinal}
								matchWidth={matchWidth}
								matchHeight={matchHeight}
								nameOf={nameOf}
								champSeedOf={champSeedOf}
								stripe={stripe}
							/>
						);
					}),
				)}
			</svg>

			{isComplete && champion && (
				<div className="mt-3 flex flex-wrap justify-center items-center gap-2">
					<div className="bg-gradient-to-br from-orange to-tan text-blue-gray px-5 py-2.5 rounded-xl font-bold text-base shadow-lg shadow-orange/20 flex items-center gap-2">
						<Crown className="w-5 h-5" /> Champion: {nameOf(champion)}
					</div>
				</div>
			)}
		</div>
	);
});

function MatchBox({ m, x, y, aWon, isPlayed, revealed, isFinal, matchWidth, matchHeight, nameOf, champSeedOf, stripe }) {
	const stripeW = 4;
	const halfH = matchHeight / 2 - 1;

	const fillFor = (won, occupied) => {
		if (!occupied) return "rgb(26 21 16)";
		if (!isPlayed) return "rgb(42 38 34)";
		if (!won) return "rgb(42 38 34)";
		if (isFinal) return "rgb(255 165 0)";
		return "rgb(42 58 36)";
	};

	const row = (slot, won, yOff) => {
		// A slot is only shown once its round has been reached.
		const occupied = revealed && !!slot;
		const label = occupied ? fitName(nameOf(slot)) : revealed && m.is_bye ? "bye" : "";
		return (
			<g>
				<rect x={0} y={yOff} width={stripeW} height={halfH} fill={stripe(occupied ? slot : null)} />
				<rect
					x={stripeW}
					y={yOff}
					width={matchWidth - stripeW}
					height={halfH}
					fill={fillFor(won, occupied)}
					stroke="rgb(58 53 47)"
					rx={2}
				/>
				{occupied && (
					<text
						x={stripeW + 18}
						y={yOff + halfH / 2 + 4}
						fill={isPlayed && won ? (isFinal ? "rgb(33 26 18)" : "#fff") : "rgb(197 195 194)"}
						fontSize="11"
						fontWeight="600"
					>
						{label}
					</text>
				)}
				{occupied && (
					<text
						x={stripeW + 6}
						y={yOff + halfH / 2 + 4}
						fill={isFinal && isPlayed && won ? "rgb(33 26 18)" : "rgb(122 106 85)"}
						fontSize="9"
						fontWeight="700"
					>
						{champSeedOf(slot)}
					</text>
				)}
				{!occupied && !m.is_bye && (
					<text x={stripeW + 8} y={yOff + halfH / 2 + 4} fill="rgb(122 106 85)" fontSize="10">
						{label}
					</text>
				)}
				{isPlayed && won && occupied && (
					<text
						x={matchWidth - 6}
						y={yOff + halfH / 2 + 4}
						fill={isFinal ? "rgb(33 26 18)" : "rgb(255 165 0)"}
						fontSize="10"
						fontWeight="700"
						textAnchor="end"
					>
						✓
					</text>
				)}
			</g>
		);
	};

	return (
		<g transform={`translate(${x}, ${y})`}>
			{row(m.a_slot, aWon, 0)}
			{row(m.b_slot, !aWon && !!m.b_slot, halfH + 2)}
		</g>
	);
}
