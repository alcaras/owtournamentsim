// Match outcome model — the ONE piece per-ankh doesn't define (it records real
// games). A player's strength is taken from their division swiss_seed (seed 1 =
// strongest). The upset slider blends between pure chalk and a coin flip.

// Deterministic PRNG so a given (seed string, upset) reproduces a tournament
// exactly — mirrors the spirit of per-ankh's seeded rng (cloud/.../rng.ts).
function xmur3(str) {
	let h = 1779033703 ^ str.length;
	for (let i = 0; i < str.length; i++) {
		h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
		h = (h << 13) | (h >>> 19);
	}
	return () => {
		h = Math.imul(h ^ (h >>> 16), 2246822507);
		h = Math.imul(h ^ (h >>> 13), 3266489909);
		return (h ^= h >>> 16) >>> 0;
	};
}

function mulberry32(a) {
	return () => {
		a |= 0;
		a = (a + 0x6d2b79f5) | 0;
		let t = Math.imul(a ^ (a >>> 15), 1 | a);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

export function makeRng(seedString) {
	const seedFn = xmur3(String(seedString));
	return mulberry32(seedFn());
}

// P(player A wins) given both players' (division) seeds and the upset level.
//   upset = 0  -> pure chalk: the better (lower) seed always wins.
//   upset = 1  -> pure coin flip (0.5) regardless of seeds.
// In between, a logistic on the seed gap whose slope shrinks toward 0.
const BETA = 0.6; // decisiveness per seed of gap at full chalk

export function favoriteWinProb(seedA, seedB, upset) {
	if (upset <= 0) {
		if (seedA === seedB) return 0.5;
		return seedA < seedB ? 1 : 0;
	}
	const slope = BETA * (1 - upset);
	const x = (seedB - seedA) * slope; // positive favors A (the lower seed)
	return 1 / (1 + Math.exp(-x));
}

// Resolve a single game. `slotsById[id].swiss_seed` is the strength index.
export function playMatch(aSlot, bSlot, slotsById, upset, rng) {
	const pA = favoriteWinProb(
		slotsById[aSlot].swiss_seed,
		slotsById[bSlot].swiss_seed,
		upset,
	);
	return rng() < pA ? aSlot : bSlot;
}
