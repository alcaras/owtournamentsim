// Tournament driver. Wires the faithful per-ankh ports (pairing, standings,
// bracket) together and resolves each game with the match model, producing one
// immutable record the UI steps through.
//
// Flow mirrors per-ankh exactly:
//   1. Two independent Swiss divisions, rounds 1..swiss_max_rounds. Each round
//      pairs only still-active slots; a division stops emitting matches once
//      fewer than two remain active. Byes award +1 win.
//   2. Championship: combine BOTH divisions into one standings cascade, take
//      everyone with status 'advanced' as qualifiers seeded 1..N, then a
//      standard 1-vs-N single-elim bracket (next power of two, R1 byes). No
//      bronze match.

import { buildChampionshipFollowupRound, buildChampionshipRound1 } from "./bracket.js";
import { makeRng, playMatch } from "./match-model.js";
import { pairSwissRound } from "./pairing.js";
import { computeStandings, rankStandings } from "./standings.js";

export function simulateTournament(slots, config, { upset, seed }) {
	const rng = makeRng(seed);

	const slotsById = {};
	for (const s of slots) {
		slotsById[s.slot_id] = {
			name: s.name,
			division: s.division,
			swiss_seed: s.swiss_seed,
		};
	}

	// ---- Swiss phase, per division ----
	const allSwissMatches = [];
	const divisions = {};
	for (const division of ["A", "B"]) {
		const divSlots = slots.filter((s) => s.division === division);
		const divMatches = [];
		const rounds = [];

		for (let r = 1; r <= config.swiss_max_rounds; r++) {
			const pairings = pairSwissRound(divSlots, divMatches, r, config);
			if (pairings.length === 0) break; // no active players left

			const roundMatches = [];
			for (const p of pairings) {
				if (p.slot_b_id === null) {
					const m = {
						round_number: r,
						division,
						slot_a_id: p.slot_a_id,
						slot_b_id: null,
						winner_slot_id: p.slot_a_id,
						status: "bye",
					};
					divMatches.push(m);
					roundMatches.push(m);
				} else {
					const winner = playMatch(
						p.slot_a_id,
						p.slot_b_id,
						slotsById,
						upset,
						rng,
					);
					const m = {
						round_number: r,
						division,
						slot_a_id: p.slot_a_id,
						slot_b_id: p.slot_b_id,
						winner_slot_id: winner,
						status: "completed",
					};
					divMatches.push(m);
					roundMatches.push(m);
				}
			}

			// Standings snapshot after this round (ranked) for the UI.
			const standings = computeStandings(divSlots, divMatches, config);
			const snapshot = rankStandings(standings, divMatches);
			rounds.push({ round_number: r, matches: roundMatches, snapshot });
		}

		divisions[division] = { rounds };
		allSwissMatches.push(...divMatches);
	}

	const numSwissSteps = Math.max(
		divisions.A.rounds.length,
		divisions.B.rounds.length,
	);

	// ---- Combined cascade -> qualifiers ----
	const combinedStandings = computeStandings(slots, allSwissMatches, config);
	const combinedRanked = rankStandings(combinedStandings, allSwissMatches);
	const qualifiers = combinedRanked.filter((r) => r.status === "advanced");
	const seedOrder = qualifiers.map((q) => q.slot_id);

	// ---- Championship bracket ----
	let championship = null;
	let champion = null;
	if (seedOrder.length >= 2) {
		const r1 = buildChampionshipRound1(seedOrder.length);
		const seedToSlot = (seedNum) => seedOrder[seedNum - 1] ?? null;

		const round1 = r1.matches.map((m) => {
			const aSlot = seedToSlot(m.seed_a);
			const bSlot = m.is_bye ? null : seedToSlot(m.seed_b);
			const winner = m.is_bye
				? aSlot
				: playMatch(aSlot, bSlot, slotsById, upset, rng);
			return {
				match_index: m.match_index,
				seed_a: m.seed_a,
				seed_b: m.seed_b,
				a_slot: aSlot,
				b_slot: bSlot,
				winner_slot_id: winner,
				is_bye: m.is_bye,
			};
		});

		const rounds = [round1];
		let prev = round1;
		while (prev.length > 1) {
			const templates = buildChampionshipFollowupRound(prev.length);
			const next = templates.map((t) => {
				const aSlot = prev[t.source_match_a_index - 1].winner_slot_id;
				const bSlot = prev[t.source_match_b_index - 1].winner_slot_id;
				const winner = playMatch(aSlot, bSlot, slotsById, upset, rng);
				return {
					match_index: t.match_index,
					a_slot: aSlot,
					b_slot: bSlot,
					winner_slot_id: winner,
					is_bye: false,
				};
			});
			rounds.push(next);
			prev = next;
		}

		champion = prev[0].winner_slot_id;
		championship = {
			qualifiers,
			seedOrder,
			bracketSize: r1.bracket_size,
			byeCount: r1.bye_count,
			rounds,
		};
	}

	return {
		config,
		upset,
		seed,
		slotsById,
		divisions,
		numSwissSteps,
		combinedRanked,
		championship,
		champion,
	};
}
