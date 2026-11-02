import { defineConfig, devices } from "@playwright/test";

// 4322: el portafolio usa 4321 y los dos pueden correr a la vez.
const PORT = 4322;
const baseURL = `http://localhost:${PORT}`;

export default defineConfig({
	testDir: "./tests/e2e",
	fullyParallel: true,
	workers: process.env.CI ? 2 : 3,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 2 : 1,
	reporter: "html",

	use: {
		baseURL,
		trace: "on-first-retry",
	},

	projects: [
		{
			name: "chromium",
			use: { ...devices["Desktop Chrome"] },
		},
	],

	// Reuses an already-running `pnpm dev` locally (fast iteration);
	// starts and tears down its own server in CI.
	webServer: {
		command: "pnpm dev",
		url: baseURL,
		reuseExistingServer: !process.env.CI,
		timeout: 60_000,
		// astro:env exige el secreto al arrancar. Las specs no llaman al backend;
		// este valor solo es un relleno para que el servidor levante.
		env: {
			API_SECRET_TOKEN: process.env.API_SECRET_TOKEN ?? "e2e-placeholder",
		},
	},
});
