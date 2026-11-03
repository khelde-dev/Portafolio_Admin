import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { THEME_SCRIPT } from "@/lib/inlineScripts";

const ROOT = join(import.meta.dirname, "../..");
const read = (path: string) => readFileSync(join(ROOT, path), "utf8");

describe("CSP con hashes (security.csp de Astro)", () => {
	const config = read("astro.config.mjs");
	const layout = read("src/layouts/Layout.astro");

	it("esta activado y declara lo que el admin carga", () => {
		expect(config).toMatch(/security:\s*\{\s*csp:/);
		for (const directive of [
			"default-src 'self'",
			"connect-src 'self'",
			"object-src 'none'",
			"frame-ancestors 'none'",
			"base-uri 'self'",
			"form-action 'self'",
			"frame-src 'none'",
		]) {
			expect(config).toContain(directive);
		}
	});

	it("ningun script ni etiqueta de estilo abre la puerta con unsafe-inline", () => {
		// Solo los atributos style="" (que no ejecutan codigo) lo llevan.
		expect([...config.matchAll(/'unsafe-inline'/g)]).toHaveLength(1);
		expect(config).toMatch(
			/resource:\s*"'unsafe-inline'",\s*kind:\s*"attribute"/,
		);
		expect(config).not.toContain("unsafe-eval");
	});

	it("el <script is:inline> del Layout sale de la constante que se hashea", () => {
		expect(layout).toContain("set:html={THEME_SCRIPT}");
		// Uno escrito a mano no tendria hash y el navegador lo bloquearia.
		expect([
			...layout.matchAll(/<script is:inline>([\s\S]*?)<\/script>/g),
		]).toEqual([]);
		expect(config).toContain("hashOf(THEME_SCRIPT)");
	});

	it("el script en linea no usa eval ni crea otros scripts", () => {
		expect(THEME_SCRIPT).not.toMatch(
			/eval\(|new Function|document\.write|innerHTML/,
		);
	});

	it("los avisos ya no dependen de una libreria que inyecta CSS", () => {
		expect(read("package.json")).not.toContain("react-hot-toast");
	});
});
