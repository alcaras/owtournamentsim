import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// base must match the GitHub Pages project path: alcaras.github.io/owtournamentsim/
export default defineConfig({
	plugins: [react()],
	base: "/owtournamentsim/",
	test: {
		environment: "node",
		include: ["src/**/*.test.{js,jsx}"],
	},
});
