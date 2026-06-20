// Real sign-ups for the 2026 Old World Community Tournament, taken from
// per-ankh.app/tournaments/2026-community-tournament in listed (seed) order.
// Division A = The New World (Americas); Division B = The Old World
// (Europe, Africa, Asia, Oceania). Seed = array index + 1.
//
// Edit these lists to run the simulator with a different field.

export const DIVISION_NAMES = {
	A: "The New World",
	B: "The Old World",
};

export const DIVISION_SUBTITLES = {
	A: "Americas",
	B: "Europe, Africa, Asia, Oceania",
};

export const ROSTER = {
	A: [
		"Ninjaa",
		"alcaras",
		"Auro",
		"Siontific",
		"Sabertooth",
		"ThePurpleBullMoose",
		"MongrelEyes",
		"HazardBringsAxe",
		"fiddlers25",
		"Magnus",
		"BluntMagic",
		"kerstad",
		"Nicknight",
		"zophister",
		"professorcurly",
		"DrunkenMeister",
		"Corset Moosifer Lebelle",
		"JCT",
		"ShaunMcNamee",
		"Godlovesus",
		"A_Modern_Major_General",
		"asteres",
		"calitiso",
		"ant",
		"Scrubinski",
		"🐦🐦ĐØɄ฿ⱠɆ₵ØⱤVłĐ🐦🐦",
	],
	B: [
		"Klass_Koala",
		"Aran",
		"fluffybunny",
		"Spider",
		"Marauder",
		"Moroten",
		"problemgambler",
		"Boldus",
		"NestorLN",
		"Michael of Minsk",
		"Max (3WordName)",
		"Napalmikoira",
		"CLIFF123",
		"solutodka.",
		"Konstant",
		"phielp",
		"IlyaGurkov",
		"finn",
		"tjumma",
		"Jel",
		"teuzet.",
		"beefy",
		"chloriss",
		"Egotheist",
		"Akuukis",
		"Quetzal",
		"jonyjonas",
		"Turius",
	],
};

// Tournament config — verbatim from the live per-ankh tournament payload.
export const CONFIG = {
	swiss_wins_to_advance: 3,
	swiss_losses_to_eliminate: 3,
	swiss_max_rounds: 5,
};

// Build the slot list the engine operates on. One slot per player; slot_id is
// stable and division-scoped so it doubles as a readable debug handle.
export function buildSlots(roster = ROSTER) {
	const slots = [];
	for (const division of ["A", "B"]) {
		roster[division].forEach((name, i) => {
			slots.push({
				slot_id: `${division}-${i + 1}`,
				division,
				swiss_seed: i + 1,
				name,
			});
		});
	}
	return slots;
}
