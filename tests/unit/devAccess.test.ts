import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearAccessKeyCache, verifyAccessJwt } from "@/server/access";
import {
	DEV_AUD,
	DEV_EMAIL,
	DEV_KID,
	DEV_TEAM,
	devJwt,
	resetDevJwt,
	signDevJwt,
} from "@/server/devAccess";
import {
	buildDevKit,
	DEV_AUD as SCRIPT_AUD,
	DEV_KID as SCRIPT_KID,
	DEV_TEAM as SCRIPT_TEAM,
} from "../../scripts/dev-access.mjs";
import { stubCerts } from "../support/forge";

const env = vi.hoisted(() => ({
	DEV_ACCESS_KEY: undefined as string | undefined,
}));
vi.mock("astro:env/server", () => env);

beforeEach(() => {
	resetDevJwt();
	clearAccessKeyCache();
	env.DEV_ACCESS_KEY = undefined;
});
afterEach(() => vi.unstubAllGlobals());

describe("el script y el servidor usan los mismos valores", () => {
	it("aud, equipo y kid coinciden", () => {
		expect([SCRIPT_AUD, SCRIPT_TEAM, SCRIPT_KID]).toEqual([
			DEV_AUD,
			DEV_TEAM,
			DEV_KID,
		]);
	});
});

describe("buildDevKit", () => {
	it("genera un par RSA con la publica lista para ACCESS_JWKS y la privada para el admin", () => {
		const kit = buildDevKit();
		expect(kit.publicJwk).toMatchObject({
			kty: "RSA",
			kid: DEV_KID,
			alg: "RS256",
			use: "sig",
		});
		expect(kit.publicJwk).not.toHaveProperty("d");
		expect(kit.privateJwk).toHaveProperty("d");
		expect(kit.adminLines[0]).toMatch(/^DEV_ACCESS_KEY='\{.*\}'$/);
		expect(kit.backendLines.join("\n")).toContain(`ACCESS_AUD=${DEV_AUD}`);
		expect(kit.backendLines.join("\n")).toContain(
			`ACCESS_TEAM_DOMAIN=${DEV_TEAM}`,
		);
		const jwks = JSON.parse(
			kit.backendLines[2].replace(/^ACCESS_JWKS='/, "").replace(/'$/, ""),
		);
		expect(jwks.keys).toHaveLength(1);
		// La linea del backend nunca lleva la llave privada.
		expect(kit.backendLines.join("\n")).not.toContain('"d"');
	});

	it("cada ejecucion genera llaves distintas", () => {
		expect(buildDevKit().privateJwk.n).not.toBe(buildDevKit().privateJwk.n);
	});
});

describe("signDevJwt", () => {
	it("el JWT firmado lo acepta el mismo verificador que usa el admin (y el backend)", async () => {
		const kit = buildDevKit();
		const jwt = await signDevJwt(kit.privateJwk as JsonWebKey);
		stubCerts(vi, [kit.publicJwk]);
		const user = await verifyAccessJwt(jwt, { team: DEV_TEAM, aud: DEV_AUD });
		expect(user.email).toBe(DEV_EMAIL);
	});

	it("vence en una hora y trae audiencia y emisor de prueba", async () => {
		const kit = buildDevKit();
		const jwt = await signDevJwt(kit.privateJwk as JsonWebKey, 1000);
		const claims = JSON.parse(
			atob(jwt.split(".")[1].replaceAll("-", "+").replaceAll("_", "/")),
		);
		expect(claims).toMatchObject({
			aud: [DEV_AUD],
			iss: DEV_TEAM,
			iat: 1000,
			exp: 4600,
		});
	});

	it("una llave de otro par no pasa la verificacion", async () => {
		const mine = buildDevKit();
		const other = buildDevKit();
		const jwt = await signDevJwt(other.privateJwk as JsonWebKey);
		stubCerts(vi, [mine.publicJwk]);
		await expect(
			verifyAccessJwt(jwt, { team: DEV_TEAM, aud: DEV_AUD }),
		).rejects.toThrow();
	});
});

describe("devJwt", () => {
	it("sin llave configurada no hay JWT (el backend dira 401/503)", async () => {
		expect(await devJwt()).toBeNull();
	});

	it("con llave firma y reutiliza el JWT hasta poco antes de vencer", async () => {
		env.DEV_ACCESS_KEY = JSON.stringify(buildDevKit().privateJwk);
		const first = await devJwt();
		expect(first).toMatch(/^[\w-]+\.[\w-]+\.[\w-]+$/);
		expect(await devJwt()).toBe(first);
	});

	it("una llave mal pegada no rompe nada: devuelve null", async () => {
		env.DEV_ACCESS_KEY = "{esto no es json";
		expect(await devJwt()).toBeNull();
		env.DEV_ACCESS_KEY = JSON.stringify({ kty: "RSA" });
		expect(await devJwt()).toBeNull();
	});
});
