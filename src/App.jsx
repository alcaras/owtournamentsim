import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronRight, Pause, Play, RotateCcw, Shuffle, Trophy } from "lucide-react";
import {
	buildSlots,
	CONFIG,
	DIVISION_NAMES,
	DIVISION_SUBTITLES,
	ROSTER,
} from "./data/players.js";
import { simulateTournament } from "./engine/simulate.js";
import { PairingsPanel, ZoneColumn } from "./components/SwissView.jsx";
import { BracketView } from "./components/BracketView.jsx";
import { SeedingPreview } from "./components/SeedingPreview.jsx";

function randomSeed() {
	return Math.random().toString(36).slice(2, 9);
}

// Synthesize a "pre-tournament" snapshot (everyone 0-0, active) for step 0.
function initialSnapshot(slots, division) {
	return slots
		.filter((s) => s.division === division)
		.sort((a, b) => a.swiss_seed - b.swiss_seed)
		.map((s) => ({
			slot_id: s.slot_id,
			wins: 0,
			losses: 0,
			status: "active",
			buchholz_cut1: 0,
			opponents_buchholz: 0,
			cumulative: 0,
			rank: s.swiss_seed,
			tied_with: [],
		}));
}

function groupByStatus(snapshot) {
	return {
		active: snapshot.filter((e) => e.status === "active"),
		advanced: snapshot.filter((e) => e.status === "advanced"),
		eliminated: snapshot.filter((e) => e.status === "eliminated"),
	};
}

export default function App() {
	const [roster] = useState(ROSTER);
	const slots = useMemo(() => buildSlots(roster), [roster]);

	const [view, setView] = useState("sim");
	const [upset, setUpset] = useState(0.35);
	const [pendingUpset, setPendingUpset] = useState(0.35);
	const [seed, setSeed] = useState(() => randomSeed());

	const t = useMemo(
		() => simulateTournament(slots, CONFIG, { upset, seed }),
		[slots, upset, seed],
	);

	const [step, setStep] = useState(0);
	const [playing, setPlaying] = useState(false);

	const numSwissSteps = t.numSwissSteps;
	const numBracketRounds = t.championship ? t.championship.rounds.length : 0;
	// Championship phase gets one extra "bracket set" step (seeds shown, nothing
	// played yet) before the per-round reveals, so it advances one round at a time.
	const bracketSteps = t.championship ? numBracketRounds + 1 : 0;
	const totalSteps = numSwissSteps + bracketSteps;
	const isComplete = step >= totalSteps;
	const inSwiss = step <= numSwissSteps;
	// Rounds whose results are revealed: 0 = bracket set, then one per step.
	const playedRounds = Math.max(
		0,
		Math.min(numBracketRounds, step - numSwissSteps - 1),
	);

	useEffect(() => {
		if (!playing) return;
		if (step >= totalSteps) {
			setPlaying(false);
			return;
		}
		const id = setTimeout(() => setStep((s) => s + 1), 1300);
		return () => clearTimeout(id);
	}, [playing, step, totalSteps]);

	const restart = (newSeed) => {
		setSeed(newSeed);
		setStep(0);
		setPlaying(false);
	};
	const commitUpset = (val) => {
		if (val === upset) return;
		setUpset(val);
		setStep(0);
		setPlaying(false);
	};
	const stepForward = () => {
		if (step < totalSteps) setStep((s) => s + 1);
	};
	const togglePlay = () => {
		if (isComplete) {
			setSeed(randomSeed());
			setStep(0);
			setPlaying(true);
		} else setPlaying((p) => !p);
	};

	// ---- lookups ----
	const nameOf = useCallback((id) => t.slotsById[id]?.name ?? "—", [t]);
	const seedOf = useCallback((id) => t.slotsById[id]?.swiss_seed ?? "?", [t]);
	const divOf = useCallback((id) => t.slotsById[id]?.division, [t]);
	const inChampionship = useMemo(
		() => new Set(t.championship?.seedOrder ?? []),
		[t],
	);
	const champSeed = useMemo(() => {
		const m = new Map();
		(t.championship?.seedOrder ?? []).forEach((id, i) => m.set(id, i + 1));
		return m;
	}, [t]);
	const champSeedOf = useCallback((id) => champSeed.get(id) ?? "", [champSeed]);

	// ---- games counter (excludes byes — those aren't played) ----
	const totalGames = useMemo(() => {
		let n = 0;
		for (const d of ["A", "B"]) {
			for (const round of t.divisions[d].rounds) {
				n += round.matches.filter((m) => m.slot_b_id !== null).length;
			}
		}
		if (t.championship) {
			for (const round of t.championship.rounds) {
				n += round.filter((m) => !m.is_bye).length;
			}
		}
		return n;
	}, [t]);
	const gamesPlayed = useMemo(() => {
		let n = 0;
		for (const d of ["A", "B"]) {
			const rounds = t.divisions[d].rounds;
			const upTo = Math.min(step, rounds.length);
			for (let i = 0; i < upTo; i++) {
				n += rounds[i].matches.filter((m) => m.slot_b_id !== null).length;
			}
		}
		if (t.championship) {
			for (let i = 0; i < playedRounds; i++) {
				n += t.championship.rounds[i].filter((m) => !m.is_bye).length;
			}
		}
		return n;
	}, [t, step, playedRounds]);

	// ---- swiss step data ----
	const snapFor = (division) => {
		const rounds = t.divisions[division].rounds;
		if (step === 0) return initialSnapshot(slots, division);
		const idx = Math.min(step, rounds.length) - 1;
		return rounds[idx]?.snapshot ?? initialSnapshot(slots, division);
	};
	const roundFor = (division) => {
		const rounds = t.divisions[division].rounds;
		return step >= 1 && step <= rounds.length ? rounds[step - 1] : null;
	};

	const groupsA = useMemo(() => groupByStatus(snapFor("A")), [t, step, slots]);
	const groupsB = useMemo(() => groupByStatus(snapFor("B")), [t, step, slots]);
	const roundA = inSwiss && step >= 1 ? roundFor("A") : null;
	const roundB = inSwiss && step >= 1 ? roundFor("B") : null;

	const { resultMap, oppMap } = useMemo(() => {
		const rm = new Map();
		const om = new Map();
		for (const round of [roundA, roundB]) {
			if (!round) continue;
			for (const m of round.matches) {
				if (m.slot_b_id === null) {
					rm.set(m.slot_a_id, "bye");
					continue;
				}
				rm.set(m.winner_slot_id, "won");
				const loser = m.slot_a_id === m.winner_slot_id ? m.slot_b_id : m.slot_a_id;
				rm.set(loser, "lost");
				om.set(m.slot_a_id, m.slot_b_id);
				om.set(m.slot_b_id, m.slot_a_id);
			}
		}
		return { resultMap: rm, oppMap: om };
	}, [roundA, roundB]);

	// ---- stage label ----
	let stageLabel, stageSub;
	if (step === 0) {
		stageLabel = "Ready to begin";
		stageSub = `${slots.length} players · two-division Swiss → Championship`;
	} else if (inSwiss) {
		const ra = roundFor("A");
		const rb = roundFor("B");
		const games =
			(ra ? ra.matches.filter((m) => m.slot_b_id !== null).length : 0) +
			(rb ? rb.matches.filter((m) => m.slot_b_id !== null).length : 0);
		stageLabel = `Swiss Round ${step} of ${numSwissSteps}`;
		stageSub = `${games} games this round`;
	} else if (isComplete) {
		stageLabel = "Tournament Complete";
		stageSub = t.champion ? `${nameOf(t.champion)} crowned champion` : "—";
	} else {
		const labels = { 1: "Final", 2: "Semifinals", 4: "Quarterfinals", 8: "Round of 16", 16: "Round of 32", 32: "Round of 64" };
		if (playedRounds === 0) {
			const r1 = t.championship.rounds[0].length;
			stageLabel = "Championship — Bracket set";
			stageSub = `Top ${t.championship.seedOrder.length} seeded · ${labels[r1] || `${r1} matches`} up next`;
		} else {
			const m = t.championship.rounds[playedRounds - 1].length;
			stageLabel = `Championship — ${labels[m] || `Round ${playedRounds}`}`;
			stageSub = m === 1 ? "Grand final" : `${m} matches`;
		}
	}

	const upsetLabel =
		pendingUpset <= 0.001
			? "Pure chalk"
			: pendingUpset >= 0.999
				? "Coin flip"
				: pendingUpset < 0.4
					? "Favorites hold"
					: pendingUpset < 0.7
						? "Competitive"
						: "Chaos";

	return (
		<div className="min-h-screen bg-blue-gray text-bright p-3">
			<div className="max-w-6xl mx-auto">
				{/* Header */}
				<div className="mb-3">
					<h1 className="text-xl md:text-2xl font-bold text-orange flex items-center gap-2">
						<span className="text-2xl">𓉑</span> Old World Community Tournament Simulator
					</h1>
					<p className="text-muted text-xs mt-1">
						Two divisions run parallel Swiss (max {CONFIG.swiss_max_rounds} rounds, 3 wins to advance,
						3 losses to eliminate). Everyone who advances is re-seeded across both divisions into one
						single-elimination championship — the exact format from{" "}
						<a className="text-tan underline hover:text-orange" href="https://per-ankh.app/tournaments/2026-community-tournament" target="_blank" rel="noreferrer">
							per-ankh.app
						</a>
						. Game results are simulated from seed strength.
					</p>
				</div>

				{/* Tabs */}
				<div className="flex gap-1 mb-3">
					{[
						["sim", "Simulator"],
						["seed", "Seeding preview"],
					].map(([id, label]) => (
						<button
							key={id}
							onClick={() => setView(id)}
							className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition ${
								view === id
									? "bg-orange text-blue-gray"
									: "bg-gray-raised text-muted hover:text-bright"
							}`}
						>
							{label}
						</button>
					))}
				</div>

				{view === "seed" && <SeedingPreview />}

				{view === "sim" && (
					<>
				{/* Controls */}
				<div className="bg-gray-deep rounded-xl p-3 mb-3 border border-border-subtle">
					<div className="flex flex-wrap items-end gap-3 mb-3">
						<div className="flex-1 min-w-[240px]">
							<div className="flex justify-between items-baseline mb-1.5">
								<label className="text-xs text-muted uppercase tracking-wider">Upset factor</label>
								<span className="text-orange font-bold text-sm">{upsetLabel}</span>
							</div>
							<input
								type="range"
								min={0}
								max={100}
								value={Math.round(pendingUpset * 100)}
								onChange={(e) => setPendingUpset(parseInt(e.target.value) / 100)}
								onPointerUp={(e) => commitUpset(parseInt(e.target.value) / 100)}
								onKeyUp={(e) => commitUpset(parseInt(e.target.value) / 100)}
								className="w-full cursor-pointer"
							/>
							<div className="flex justify-between text-xs text-muted mt-0.5">
								<span>seeds always win</span>
								<span>pure coin flip</span>
							</div>
						</div>
						<div className="flex gap-2">
							<button
								onClick={togglePlay}
								className="px-3 py-1.5 bg-orange hover:bg-tan text-blue-gray rounded-lg font-semibold flex items-center gap-1.5 transition text-sm"
							>
								{playing ? (
									<>
										<Pause className="w-4 h-4" /> Pause
									</>
								) : isComplete ? (
									<>
										<Shuffle className="w-4 h-4" /> Replay
									</>
								) : (
									<>
										<Play className="w-4 h-4" /> Play
									</>
								)}
							</button>
							<button
								onClick={stepForward}
								disabled={isComplete || playing}
								className="px-2.5 py-1.5 bg-gray-raised hover:bg-gray-hover disabled:opacity-40 disabled:cursor-not-allowed rounded-lg flex items-center gap-1 transition text-sm"
							>
								<ChevronRight className="w-4 h-4" /> Step
							</button>
							<button
								onClick={() => restart(randomSeed())}
								className="px-2.5 py-1.5 bg-gray hover:bg-gray-hover rounded-lg flex items-center gap-1 transition text-sm"
								title="New random outcomes"
							>
								<Shuffle className="w-4 h-4" /> Shuffle
							</button>
							<button
								onClick={() => {
									setStep(0);
									setPlaying(false);
								}}
								className="px-2.5 py-1.5 bg-gray hover:bg-gray-hover rounded-lg flex items-center gap-1 transition text-sm"
								title="Replay these same outcomes"
							>
								<RotateCcw className="w-4 h-4" /> Reset
							</button>
						</div>
					</div>

					<div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs mb-1.5">
						<span className="text-muted">
							<span className="text-newworld font-medium">{roster.A.length}</span>
							<span className="opacity-50"> + </span>
							<span className="text-oldworld font-medium">{roster.B.length}</span> players →{" "}
							<span className="text-bright font-medium">{numSwissSteps} Swiss rounds</span> →{" "}
							{t.championship ? (
								<span className="text-orange font-medium">
									top {t.championship.seedOrder.length} championship
								</span>
							) : (
								<span className="text-muted">no qualifiers</span>
							)}
						</span>
						<span className="ml-auto text-muted">
							<span className="text-bright font-medium">{gamesPlayed}</span>
							<span className="opacity-50"> / </span>
							{totalGames} games played
						</span>
						<span className="text-muted">
							seed <code className="text-tan">{seed}</code>
						</span>
					</div>
					<div className="flex justify-between items-baseline mb-1">
						<span className="text-orange font-semibold text-sm">{stageLabel}</span>
						<span className="text-xs text-muted">{stageSub}</span>
					</div>
					<div className="h-1.5 bg-gray rounded-full overflow-hidden">
						<div
							className="h-full bg-gradient-to-r from-orange to-tan transition-all duration-500"
							style={{ width: `${totalSteps > 0 ? (step / totalSteps) * 100 : 0}%` }}
						/>
					</div>
				</div>

				{/* Swiss view */}
				{inSwiss && (
					<>
						<div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-3">
							<ZoneColumn
								division="A"
								name={DIVISION_NAMES.A}
								subtitle={DIVISION_SUBTITLES.A}
								groups={groupsA}
								resultMap={resultMap}
								oppMap={oppMap}
								nameOf={nameOf}
								seedOf={seedOf}
								total={roster.A.length}
								showCut={step === numSwissSteps}
								inChampionship={inChampionship}
							/>
							<ZoneColumn
								division="B"
								name={DIVISION_NAMES.B}
								subtitle={DIVISION_SUBTITLES.B}
								groups={groupsB}
								resultMap={resultMap}
								oppMap={oppMap}
								nameOf={nameOf}
								seedOf={seedOf}
								total={roster.B.length}
								showCut={step === numSwissSteps}
								inChampionship={inChampionship}
							/>
						</div>
						{step >= 1 && (
							<PairingsPanel
								step={step}
								roundA={roundA}
								roundB={roundB}
								names={DIVISION_NAMES}
								nameOf={nameOf}
							/>
						)}
					</>
				)}

				{/* Championship view */}
				{!inSwiss && t.championship && (
					<BracketView
						championship={t.championship}
						playedRounds={playedRounds}
						isComplete={isComplete}
						champion={t.champion}
						nameOf={nameOf}
						divOf={divOf}
						champSeedOf={champSeedOf}
					/>
				)}
				{!inSwiss && !t.championship && (
					<div className="bg-gray-deep rounded-xl p-6 border border-border-subtle text-center text-muted">
						Fewer than two players advanced — no championship.
					</div>
				)}
					</>
				)}

				<div className="mt-3 text-center text-[11px] text-muted">
					Format & algorithms ported from{" "}
					<a className="text-tan underline hover:text-orange" href="https://github.com/alcaras/per-ankh" target="_blank" rel="noreferrer">
						per-ankh
					</a>
					. Win probabilities are a simulation model, not real results.
				</div>
			</div>
		</div>
	);
}
