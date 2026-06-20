// W/L tallying, tiebreaker scoring, and the bracket-seeding cascade.
//
// Ported verbatim from per-ankh: cloud/src/tournament/standings.ts. Kept in
// plain JS with the original comments so the two can be diffed. The only
// behavioural difference is that this runs client-side over an in-memory match
// list instead of D1 rows.
//
// Cascade for bracket seeding:
//   1. Losses (ascending), with wins (descending) as the primary axis for
//      the full-standings view — i.e. the composite key (wins desc, losses
//      asc). For qualifiers wins is constant at the advance threshold, so
//      Tier 1 reduces to losses asc — equivalently, "rounds taken to clinch."
//   2. Head-to-head — sum of wins against other still-tied players
//   3. Buchholz cut-1 — sum of opponents' wins, lowest dropped
//   4. Opponents' Buchholz — sum of each opponent's Buchholz cut-1.
//   5. Cumulative — sum of running win count across rounds (Harkness)
//   6. Initial swiss seed, then slot_id — a deterministic terminal key.

export function computeRecord(slotId, matches, config) {
	let wins = 0;
	let losses = 0;
	for (const m of matches) {
		const isParticipant = m.slot_a_id === slotId || m.slot_b_id === slotId;
		if (!isParticipant) continue;
		if (m.status === "pending") continue;
		if (m.winner_slot_id === slotId) {
			wins++;
		} else if (m.winner_slot_id !== null) {
			losses++;
		}
	}
	let status = "active";
	if (wins >= config.swiss_wins_to_advance) status = "advanced";
	else if (losses >= config.swiss_losses_to_eliminate) status = "eliminated";
	return { slot_id: slotId, wins, losses, status };
}

// Collect the set of opponent slot IDs a given slot has played, excluding
// byes. Used by Buchholz computation.
function collectOpponents(slotId, matches) {
	const opponents = [];
	for (const m of matches) {
		if (m.status === "pending" || m.status === "bye") continue;
		if (m.slot_b_id === null) continue;
		if (m.slot_a_id === slotId) opponents.push(m.slot_b_id);
		else if (m.slot_b_id === slotId) opponents.push(m.slot_a_id);
	}
	return opponents;
}

// Buchholz cut-1: sort opponent wins ascending, drop the single lowest,
// sum the rest. For <=1 opponent, no trim (return the full sum).
function computeBuchholzCut1(opponentWins) {
	if (opponentWins.length <= 1) {
		return opponentWins.reduce((a, b) => a + b, 0);
	}
	const sorted = [...opponentWins].sort((a, b) => a - b);
	return sorted.slice(1).reduce((a, b) => a + b, 0);
}

// Cumulative (Harkness): for each round the slot has any match, take the
// slot's running W count *after* that round, and sum across rounds. Rounds
// where the slot didn't play carry the frozen running W across max_rounds.
function computeCumulative(slotId, matches, maxRounds) {
	const byRound = new Map();
	for (const m of matches) {
		if (m.slot_a_id !== slotId && m.slot_b_id !== slotId) continue;
		byRound.set(m.round_number, m);
	}
	let runningWins = 0;
	let total = 0;
	for (let r = 1; r <= maxRounds; r++) {
		const m = byRound.get(r);
		if (m && m.status !== "pending") {
			if (m.status === "bye") {
				if (m.slot_a_id === slotId || m.slot_b_id === slotId) {
					runningWins++;
				}
			} else if (m.winner_slot_id === slotId) {
				runningWins++;
			}
		}
		total += runningWins;
	}
	return total;
}

// Pairwise head-to-head: count completed (non-bye, non-pending) matches the
// slot won against any opponent in `tiedIds`.
function computePairwiseH2H(slotId, tiedIds, matches) {
	let h2h = 0;
	for (const m of matches) {
		if (m.status === "pending" || m.status === "bye") continue;
		if (m.winner_slot_id !== slotId) continue;
		const isAB = m.slot_a_id === slotId && m.slot_b_id !== null;
		const isBA = m.slot_b_id === slotId;
		if (!isAB && !isBA) continue;
		const opponentId = isAB ? m.slot_b_id : m.slot_a_id;
		if (tiedIds.has(opponentId)) h2h++;
	}
	return h2h;
}

export function computeStandings(slots, matches, config) {
	const recordById = new Map();
	for (const s of slots) {
		recordById.set(s.slot_id, computeRecord(s.slot_id, matches, config));
	}

	// Pass 1: per-slot Buchholz cut-1 and cumulative.
	const buchholzBySlot = new Map();
	const partial = new Map();
	for (const s of slots) {
		const rec = recordById.get(s.slot_id);
		const opponentWins = collectOpponents(s.slot_id, matches).map(
			(oid) => recordById.get(oid)?.wins ?? 0,
		);
		const buchholz_cut1 = computeBuchholzCut1(opponentWins);
		const cumulative = computeCumulative(
			s.slot_id,
			matches,
			config.swiss_max_rounds,
		);
		buchholzBySlot.set(s.slot_id, buchholz_cut1);
		partial.set(s.slot_id, { rec, buchholz_cut1, cumulative });
	}

	// Pass 2: opponents' Buchholz.
	const standings = [];
	for (const s of slots) {
		const { rec, buchholz_cut1, cumulative } = partial.get(s.slot_id);
		const opponents_buchholz = collectOpponents(s.slot_id, matches).reduce(
			(sum, oid) => sum + (buchholzBySlot.get(oid) ?? 0),
			0,
		);
		standings.push({
			...rec,
			buchholz_cut1,
			opponents_buchholz,
			cumulative,
			swiss_seed: s.swiss_seed,
		});
	}
	return standings;
}

// Rank a group of standings using the seeding cascade. Slots that share every
// *meaningful* tier value (1-5) share a rank and list each other in
// `tied_with`. Tier 6 (swiss seed, then slot_id) fixes the emission order.
export function rankStandings(standings, matches) {
	// Tier 1: composite (wins desc, losses asc).
	const WINS_WEIGHT = 1000;
	let groups = groupByKey(standings, (s) => s.losses - WINS_WEIGHT * s.wins);

	// Tier 2: H2H sum-of-points within each still-tied group.
	const h2hByPair = new Map();
	const newGroups = [];
	for (const group of groups) {
		if (group.length <= 1) {
			newGroups.push(group);
			if (group.length === 1) h2hByPair.set(group[0].slot_id, 0);
			continue;
		}
		const tiedIds = new Set(group.map((s) => s.slot_id));
		const withH2H = group.map((s) => ({
			s,
			h2h: computePairwiseH2H(s.slot_id, tiedIds, matches),
		}));
		for (const { s, h2h } of withH2H) h2hByPair.set(s.slot_id, h2h);
		const subgroups = groupByKey(withH2H, (x) => -x.h2h);
		for (const sg of subgroups) newGroups.push(sg.map((x) => x.s));
	}
	groups = newGroups;

	// Tier 3: Buchholz cut-1.
	groups = groups.flatMap((group) =>
		group.length <= 1 ? [group] : groupByKey(group, (s) => -s.buchholz_cut1),
	);

	// Tier 4: Opponents' Buchholz.
	groups = groups.flatMap((group) =>
		group.length <= 1
			? [group]
			: groupByKey(group, (s) => -s.opponents_buchholz),
	);

	// Tier 5: Cumulative.
	groups = groups.flatMap((group) =>
		group.length <= 1 ? [group] : groupByKey(group, (s) => -s.cumulative),
	);

	// Tier 6: deterministic terminal key (swiss seed asc, then slot_id asc).
	for (const group of groups) {
		if (group.length <= 1) continue;
		group.sort(
			(a, b) =>
				(a.swiss_seed ?? Infinity) - (b.swiss_seed ?? Infinity) ||
				(a.slot_id < b.slot_id ? -1 : a.slot_id > b.slot_id ? 1 : 0),
		);
	}

	// Assemble ranked output. Slots in the same final group share a rank.
	const ranked = [];
	let nextRank = 1;
	for (const group of groups) {
		const groupRank = nextRank;
		const groupIds = group.map((s) => s.slot_id);
		for (const s of group) {
			ranked.push({
				...s,
				rank: groupRank,
				tied_with:
					group.length > 1 ? groupIds.filter((id) => id !== s.slot_id) : [],
				h2h: h2hByPair.get(s.slot_id) ?? 0,
			});
		}
		nextRank += group.length;
	}
	return ranked;
}

// Helper: group a list by a numeric key, preserving ascending sort by key.
// Items within the same key keep their input order (stable).
function groupByKey(items, keyFn) {
	const sorted = [...items].sort((a, b) => keyFn(a) - keyFn(b));
	const out = [];
	let current = [];
	let currentKey = null;
	for (const item of sorted) {
		const k = keyFn(item);
		if (currentKey === null || k !== currentKey) {
			if (current.length > 0) out.push(current);
			current = [];
			currentKey = k;
		}
		current.push(item);
	}
	if (current.length > 0) out.push(current);
	return out;
}
