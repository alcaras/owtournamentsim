// Championship bracket construction.
//
// Ported verbatim from per-ankh: cloud/src/tournament/bracket.ts.
//
// Input: a flat list of qualifier slot IDs in ranked order (seed 1 first).
// Output: a list of round-1 matches, with byes for non-power-of-2 counts.
//
// Bracket size = next power of 2 >= qualifierCount. Phantom seeds
// (qualifierCount+1..bracketSize) cause their R1 opponent to receive a bye.
//
// Seeding follows standard 1-vs-N tournament order: (1, N), (2, N-1), ...
// arranged so adjacent R1 matches feed into the same R2 match.

export function largestPowerOfTwoAtLeast(n) {
	if (n < 1) return 1;
	let p = 1;
	while (p < n) p *= 2;
	return p;
}

// Build standard tournament seed pairings for a power-of-2 bracket.
// For N=2: [(1, 2)].
// For N=4: [(1, 4), (2, 3)].
// For N=8: [(1, 8), (4, 5), (2, 7), (3, 6)].
export function standardBracketPairs(n) {
	if (n < 2 || (n & (n - 1)) !== 0) {
		throw new Error(`Bracket size must be a power of 2 >= 2; got ${n}`);
	}
	if (n === 2) return [[1, 2]];
	const half = standardBracketPairs(n / 2);
	const result = [];
	for (const [a, b] of half) {
		result.push([a, n + 1 - a]);
		result.push([b, n + 1 - b]);
	}
	return result;
}

export function buildChampionshipRound1(qualifierCount) {
	if (qualifierCount < 2) {
		throw new Error(
			`Championship requires at least 2 qualifiers; got ${qualifierCount}`,
		);
	}
	const bracket_size = largestPowerOfTwoAtLeast(qualifierCount);
	const pairs = standardBracketPairs(bracket_size);
	const matches = pairs.map(([a, b], i) => ({
		match_index: i + 1,
		seed_a: a,
		seed_b: b,
		// seed_b > qualifierCount means seed_b is a phantom -> bye for seed_a.
		is_bye: b > qualifierCount,
	}));
	const bye_count = matches.filter((m) => m.is_bye).length;
	return { bracket_size, bye_count, matches };
}

// Subsequent rounds: winner of match 2i-1 faces winner of match 2i.
export function buildChampionshipFollowupRound(priorRoundMatchCount) {
	if (priorRoundMatchCount % 2 !== 0) {
		throw new Error(
			`Prior round must have an even number of matches; got ${priorRoundMatchCount}`,
		);
	}
	const matches = [];
	for (let i = 0; i < priorRoundMatchCount / 2; i++) {
		matches.push({
			match_index: i + 1,
			source_match_a_index: 2 * i + 1,
			source_match_b_index: 2 * i + 2,
		});
	}
	return matches;
}
