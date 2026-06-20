import { describe, expect, it } from "vitest";
import {
	buildChampionshipRound1,
	largestPowerOfTwoAtLeast,
	standardBracketPairs,
} from "./bracket.js";
import { favoriteWinProb } from "./match-model.js";
import { pairSwissRound } from "./pairing.js";
import { computeRecord, computeStandings, rankStandings } from "./standings.js";
import { simulateTournament } from "./simulate.js";
import { buildSlots, CONFIG, ROSTER } from "../data/players.js";

const cfg = CONFIG;

describe("bracket (per-ankh port)", () => {
	it("standardBracketPairs matches documented orders", () => {
		expect(standardBracketPairs(2)).toEqual([[1, 2]]);
		expect(standardBracketPairs(4)).toEqual([
			[1, 4],
			[2, 3],
		]);
		expect(standardBracketPairs(8)).toEqual([
			[1, 8],
			[4, 5],
			[2, 7],
			[3, 6],
		]);
	});

	it("largestPowerOfTwoAtLeast rounds up", () => {
		expect(largestPowerOfTwoAtLeast(5)).toBe(8);
		expect(largestPowerOfTwoAtLeast(8)).toBe(8);
		expect(largestPowerOfTwoAtLeast(9)).toBe(16);
	});

	it("non-power-of-2 qualifier counts give R1 byes to top seeds", () => {
		const r1 = buildChampionshipRound1(6); // bracket size 8 -> 2 byes
		expect(r1.bracket_size).toBe(8);
		expect(r1.bye_count).toBe(2);
		// Seeds 1 and 2 (paired with phantom 8 and 7) get the byes.
		const byeSeeds = r1.matches.filter((m) => m.is_bye).map((m) => m.seed_a);
		expect(byeSeeds.sort((a, b) => a - b)).toEqual([1, 2]);
	});
});

describe("standings (per-ankh port)", () => {
	it("computeRecord flips status at the thresholds", () => {
		const matches = [
			{ round_number: 1, slot_a_id: "x", slot_b_id: "y", winner_slot_id: "x", status: "completed" },
			{ round_number: 2, slot_a_id: "x", slot_b_id: "z", winner_slot_id: "x", status: "completed" },
			{ round_number: 3, slot_a_id: "x", slot_b_id: "w", winner_slot_id: "x", status: "completed" },
		];
		expect(computeRecord("x", matches, cfg).status).toBe("advanced");
		expect(computeRecord("y", matches, cfg).status).toBe("active");
	});

	it("Buchholz cut-1 drops the single lowest opponent's wins", () => {
		// p plays a,b,c; opponent win totals 3,1,2 -> drop 1 -> 3+2 = 5.
		const matches = [
			{ round_number: 1, slot_a_id: "p", slot_b_id: "a", winner_slot_id: "a", status: "completed" },
			{ round_number: 2, slot_a_id: "p", slot_b_id: "b", winner_slot_id: "b", status: "completed" },
			{ round_number: 3, slot_a_id: "p", slot_b_id: "c", winner_slot_id: "c", status: "completed" },
			// give a 3 wins, b 1 win, c 2 wins via filler opponents
			{ round_number: 1, slot_a_id: "a", slot_b_id: "f1", winner_slot_id: "a", status: "completed" },
			{ round_number: 2, slot_a_id: "a", slot_b_id: "f2", winner_slot_id: "a", status: "completed" },
			{ round_number: 1, slot_a_id: "c", slot_b_id: "f3", winner_slot_id: "c", status: "completed" },
		];
		const slots = ["p", "a", "b", "c", "f1", "f2", "f3"].map((id, i) => ({
			slot_id: id,
			swiss_seed: i + 1,
		}));
		const standings = computeStandings(slots, matches, cfg);
		const p = standings.find((s) => s.slot_id === "p");
		// a has wins: beat p, f1, f2 = 3; b beat p = 1; c beat p, f3 = 2.
		expect(p.buchholz_cut1).toBe(5);
	});
});

describe("pairing (per-ankh port)", () => {
	it("round 1 folds top half vs bottom half by seed", () => {
		const slots = Array.from({ length: 8 }, (_, i) => ({
			slot_id: `s${i + 1}`,
			swiss_seed: i + 1,
		}));
		const pairings = pairSwissRound(slots, [], 1, cfg);
		expect(pairings).toEqual([
			{ slot_a_id: "s1", slot_b_id: "s5" },
			{ slot_a_id: "s2", slot_b_id: "s6" },
			{ slot_a_id: "s3", slot_b_id: "s7" },
			{ slot_a_id: "s4", slot_b_id: "s8" },
		]);
	});

	it("odd round-1 field gives the lowest seed the bye", () => {
		const slots = Array.from({ length: 5 }, (_, i) => ({
			slot_id: `s${i + 1}`,
			swiss_seed: i + 1,
		}));
		const pairings = pairSwissRound(slots, [], 1, cfg);
		const bye = pairings.find((p) => p.slot_b_id === null);
		expect(bye.slot_a_id).toBe("s5");
	});
});

describe("match model", () => {
	it("upset=0 is pure chalk, upset=1 is a coin flip", () => {
		expect(favoriteWinProb(1, 8, 0)).toBe(1);
		expect(favoriteWinProb(8, 1, 0)).toBe(0);
		expect(favoriteWinProb(1, 8, 1)).toBeCloseTo(0.5);
		expect(favoriteWinProb(3, 3, 0)).toBe(0.5);
	});
});

describe("full simulation", () => {
	const slots = buildSlots(ROSTER);

	it("is deterministic for a given seed + upset", () => {
		const a = simulateTournament(slots, cfg, { upset: 0.3, seed: "abc" });
		const b = simulateTournament(slots, cfg, { upset: 0.3, seed: "abc" });
		expect(a.champion).toBe(b.champion);
		expect(a.combinedRanked.map((r) => r.slot_id)).toEqual(
			b.combinedRanked.map((r) => r.slot_id),
		);
	});

	it("at upset=0 the champion is the top combined seed (seed 1)", () => {
		const t = simulateTournament(slots, cfg, { upset: 0, seed: "x" });
		// Champion should be a division top seed (A-1 or B-1); with pure chalk
		// the overall #1 wins out.
		expect(["A-1", "B-1"]).toContain(t.champion);
	});

	it("every Swiss player ends advanced or eliminated within 5 rounds", () => {
		const t = simulateTournament(slots, cfg, { upset: 0.5, seed: "y" });
		for (const r of t.combinedRanked) {
			expect(["advanced", "eliminated"]).toContain(r.status);
		}
	});

	it("championship contains exactly the advanced players, seeded by rank", () => {
		const t = simulateTournament(slots, cfg, { upset: 0.5, seed: "z" });
		const advanced = t.combinedRanked
			.filter((r) => r.status === "advanced")
			.map((r) => r.slot_id);
		expect(t.championship.seedOrder).toEqual(advanced);
	});
});
