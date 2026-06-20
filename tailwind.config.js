/** @type {import('tailwindcss').Config} */
// Palette lifted verbatim from per-ankh (../per-ankh/src/app.css) so the
// simulator reads as an official companion tool.
export default {
	content: ["./index.html", "./src/**/*.{js,jsx}"],
	theme: {
		extend: {
			colors: {
				black: "rgb(0 0 0 / <alpha-value>)",
				orange: "rgb(255 165 0 / <alpha-value>)",
				tan: "rgb(210 180 140 / <alpha-value>)",
				"tan-light": "rgb(232 216 184 / <alpha-value>)",
				yellow: "rgb(255 255 0 / <alpha-value>)",
				"blue-gray": "rgb(33 26 18 / <alpha-value>)",
				"border-gray": "rgb(28 22 15 / <alpha-value>)",
				bright: "rgb(219 222 227 / <alpha-value>)",
				muted: "rgb(122 106 85 / <alpha-value>)",
				gray: {
					200: "rgb(238 238 238 / <alpha-value>)",
					DEFAULT: "rgb(42 38 34 / <alpha-value>)",
					deep: "rgb(26 21 16 / <alpha-value>)",
					sunken: "rgb(36 31 27 / <alpha-value>)",
					hover: "rgb(62 56 51 / <alpha-value>)",
					raised: "rgb(53 48 43 / <alpha-value>)",
				},
				"border-subtle": "rgb(58 53 47 / <alpha-value>)",
				success: {
					DEFAULT: "rgb(140 200 120 / <alpha-value>)",
					surface: "rgb(42 58 36 / <alpha-value>)",
				},
				danger: {
					DEFAULT: "rgb(200 110 90 / <alpha-value>)",
					surface: "rgb(58 38 34 / <alpha-value>)",
				},
				// Division accents (distinct hues that still sit in the warm palette).
				newworld: "rgb(120 170 200 / <alpha-value>)",
				oldworld: "rgb(210 150 90 / <alpha-value>)",
			},
		},
	},
	plugins: [],
};
