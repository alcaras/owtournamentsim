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
});
