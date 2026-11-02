import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Higiene del repositorio publico: lo que nunca debe llegar a GitHub ni al
 * navegador, y las reglas de arquitectura que el admin promete (docs/ARQUITECTURA.md).
 */
const ROOT = process.cwd();
const SKIP = new Set([
	"node_modules",
	".git",
	"dist",
	".astro",
	".wrangler",
	"coverage",
	"playwright-report",
	"test-results",
]);

const walk = (dir: string, out: string[] = []): string[] => {
	for (const name of readdirSync(dir)) {
		if (SKIP.has(name)) continue;
		const path = join(dir, name);
		if (statSync(path).isDirectory()) walk(path, out);
		else out.push(path);
	}
	return out;
};

const rel = (f: string) => f.slice(ROOT.length + 1).replaceAll("\\", "/");
const read = (f: string) => readFileSync(f, "utf8");
const all = walk(ROOT);
const source = all.filter((f) => /^src\/.*\.(ts|tsx|astro)$/.test(rel(f)));
const config = read(join(ROOT, "astro.config.mjs"));

describe("secretos", () => {
	const patterns: [string, RegExp][] = [
		["clave privada", /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
		[
			"token de GitHub/AWS",
			/\b(?:ghp_|gho_|github_pat_|AKIA)[A-Za-z0-9_]{16,}/,
		],
		[
			"JWT embebido",
			/\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/,
		],
	];
	for (const [name, pattern] of patterns) {
		it(`ningun archivo versionado contiene ${name}`, () => {
			const hits = all
				.filter(
					(f) =>
						/\.(ts|tsx|astro|mjs|json|jsonc|md|yml|yaml|toml)$/.test(f) &&
						!rel(f).startsWith("tests/") &&
						!/pnpm-lock\.yaml$/.test(f),
				)
				.filter((f) => pattern.test(read(f)))
				.map(rel);
			expect(hits).toEqual([]);
		});
	}

	it(".gitignore cubre .env y .dev.vars", () => {
		const ignore = read(join(ROOT, ".gitignore"));
		for (const entry of [".env", ".dev.vars"]) expect(ignore).toContain(entry);
	});

	it("wrangler.jsonc no declara el secreto en `vars`", () => {
		const wrangler = read(join(ROOT, "wrangler.jsonc"));
		const vars = wrangler.slice(wrangler.indexOf('"vars"'));
		expect(vars.split("}")[0]).not.toContain("API_SECRET_TOKEN");
	});
});

describe("el token del backend es solo de servidor", () => {
	it("API_SECRET_TOKEN solo se importa en src/server/", () => {
		const users = source
			.filter((f) => read(f).includes("API_SECRET_TOKEN"))
			.map(rel)
			.sort();
		expect(users).toEqual(["src/server/backendClient.ts"]);
	});

	it("astro.config lo declara como secreto de servidor", () => {
		expect(config).toMatch(
			/API_SECRET_TOKEN:\s*envField\.string\(\{\s*context:\s*"server",\s*access:\s*"secret"/,
		);
	});

	it("las unicas variables de cliente son URLs publicas", () => {
		const clientVars = [
			...config.matchAll(/(\w+):\s*envField\.\w+\(\{\s*context:\s*"client"/g),
		].map((m) => m[1]);
		expect(clientVars.sort()).toEqual([
			"PUBLIC_MEDIA_URL",
			"PUBLIC_PORTFOLIO_URL",
		]);
	});

	it("el navegador no importa nada de src/server/", () => {
		const offenders = source
			.filter((f) => /^src\/(components|features|hooks)\//.test(rel(f)))
			.filter((f) => /from ["']@\/server\//.test(read(f)))
			.map(rel);
		expect(offenders).toEqual([]);
	});
});

describe("el admin no tiene login propio", () => {
	it("no hay formularios de contraseña ni rutas de sesion", () => {
		const hits = source
			.filter((f) => /type=["']password["']|\/login|signIn\(/.test(read(f)))
			.map(rel);
		expect(hits).toEqual([]);
	});

	it("no hay URLs de infraestructura escritas fuera de la configuracion", () => {
		const hits = source
			.filter((f) =>
				/https?:\/\/[^\s"'`]*(workers\.dev|r2\.dev|khelde\.)/.test(read(f)),
			)
			.map(rel);
		expect(hits).toEqual([]);
	});
});

describe("superficie de XSS", () => {
	it("no hay innerHTML, dangerouslySetInnerHTML, document.write ni eval", () => {
		const hits = source
			.filter((f) =>
				/\.(innerHTML|outerHTML)\s*=|dangerouslySetInnerHTML|insertAdjacentHTML|document\.write|\beval\(|new Function\(/.test(
					read(f),
				),
			)
			.map(rel);
		expect(hits).toEqual([]);
	});

	it("todo enlace que abre pestaña nueva lleva rel con noopener", () => {
		const bad = source.filter((f) =>
			[...read(f).matchAll(/<a\b[^>]*>/gs)].some(
				([tag]) =>
					/target=["']_blank["']/.test(tag) &&
					!/rel=["'][^"']*noopener/.test(tag),
			),
		);
		expect(bad.map(rel)).toEqual([]);
	});
});

describe("workflows de GitHub", () => {
	const workflows = all.filter((f) =>
		/^\.github\/workflows\/.*\.ya?ml$/.test(rel(f)),
	);

	it("todos declaran permisos minimos", () => {
		for (const f of workflows)
			expect(read(f), rel(f)).toMatch(/^permissions:/m);
	});

	it("ninguno usa pull_request_target", () => {
		for (const f of workflows)
			expect(read(f), rel(f)).not.toContain("pull_request_target");
	});
});
