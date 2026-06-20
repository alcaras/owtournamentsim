import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import App from "../App.jsx";
import { BracketView } from "./BracketView.jsx";
import { buildSlots, CONFIG, ROSTER } from "../data/players.js";
import { simulateTournament } from "../engine/simulate.js";

// Render-phase smoke tests: catch undefined-access / prop bugs the engine unit
// tests and the build step don't exercise.
describe("rendering", () => {
	it("App renders to markup without throwing", () => {
		const html = renderToString(<App />);
		expect(html).toContain("Old World Community Tournament Simulator");
	});

	it("BracketView renders a completed championship", () => {
		const t = simulateTournament(buildSlots(ROSTER), CONFIG, {
			upset: 0.4,
			seed: "render-test",
		});
		const champSeed = new Map(t.championship.seedOrder.map((id, i) => [id, i + 1]));
		const html = renderToString(
			<BracketView
				championship={t.championship}
				playedRounds={t.championship.rounds.length}
				isComplete={true}
				champion={t.champion}
				nameOf={(id) => t.slotsById[id]?.name ?? "—"}
				divOf={(id) => t.slotsById[id]?.division}
				champSeedOf={(id) => champSeed.get(id) ?? ""}
			/>,
		);
		expect(html).toContain("Champion:");
		expect(html).toContain(t.slotsById[t.champion].name);
	});

	it("does not reveal future-round participants before their round is reached", () => {
		const t = simulateTournament(buildSlots(ROSTER), CONFIG, {
			upset: 0.4,
			seed: "render-test",
		});
		const champSeed = new Map(t.championship.seedOrder.map((id, i) => [id, i + 1]));
		const props = {
			championship: t.championship,
			isComplete: false,
			champion: t.champion,
			nameOf: (id) => t.slotsById[id]?.name ?? "—",
			divOf: (id) => t.slotsById[id]?.division,
			champSeedOf: (id) => champSeed.get(id) ?? "",
		};
		// Bracket just set (R1 seeded, nothing played): the eventual champion's
		// name must NOT appear (they only show up once they reach a later round),
		// unless they happen to be an R1 participant.
		const r1Slots = new Set(
			t.championship.rounds[0].flatMap((m) => [m.a_slot, m.b_slot]),
		);
		const finalist = t.championship.rounds.at(-1)[0];
		// A player who first appears in the final (won at least one prior round).
		const lateName = t.slotsById[finalist.a_slot].name;
		const lateIsR1 = r1Slots.has(finalist.a_slot);

		const seedingHtml = renderToString(
			<BracketView {...props} playedRounds={0} />,
		);
		if (!lateIsR1) {
			expect(seedingHtml).not.toContain(lateName);
		}
		// R1 participants ARE shown at the seeding step.
		const r1Name = t.slotsById[t.championship.rounds[0][0].a_slot].name;
		expect(seedingHtml).toContain(r1Name);
	});
});
