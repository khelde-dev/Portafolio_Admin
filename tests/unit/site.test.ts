import { describe, expect, it } from "vitest";
import { projectUrl, siteOrigin } from "@/lib/site";

describe("enlaces al portafolio publico", () => {
	it("deja solo el origen: una ruta puesta por error se descarta", () => {
		expect(siteOrigin("https://khelde.dev")).toBe("https://khelde.dev");
		expect(siteOrigin("https://khelde.dev/")).toBe("https://khelde.dev");
		expect(siteOrigin("https://portafolio.example.workers.dev/es/home")).toBe(
			"https://portafolio.example.workers.dev",
		);
	});

	it("si no es una URL valida, solo quita las barras finales", () => {
		expect(siteOrigin("sitio//")).toBe("sitio");
	});

	it("la pagina de un proyecto no repite /es/home", () => {
		expect(
			projectUrl(
				"https://portafolio.example.workers.dev/es/home",
				"frontend-kindergarden",
			),
		).toBe(
			"https://portafolio.example.workers.dev/es/project/frontend-kindergarden",
		);
		expect(projectUrl("https://khelde.dev", "a b")).toBe(
			"https://khelde.dev/es/project/a%20b",
		);
	});
});
