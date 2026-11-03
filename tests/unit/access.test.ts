import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	ACCESS_HEADER,
	authenticate,
	clearAccessKeyCache,
	parseAllowedEmails,
	verifyAccessJwt,
} from "@/server/access";
import { AUD, claims, makeForge, stubCerts, TEAM } from "../support/forge";

let forge: Awaited<ReturnType<typeof makeForge>>;

beforeEach(async () => {
	clearAccessKeyCache();
	forge = await makeForge();
	stubCerts(vi, [forge.publicJwk]);
});
afterEach(() => vi.unstubAllGlobals());

const headersWith = (token?: string) =>
	new Headers(token ? { [ACCESS_HEADER]: token } : {});
const config = { team: TEAM, aud: AUD };

describe("verifyAccessJwt", () => {
	it("acepta un token valido y devuelve el correo y la expiracion", async () => {
		const c = claims();
		const user = await verifyAccessJwt(await forge.sign(c), config);
		expect(user).toEqual({ email: "yo@ejemplo.dev", exp: c.exp });
	});

	it("acepta el emisor con barra final y la audiencia como texto", async () => {
		const token = await forge.sign(claims({ iss: `${TEAM}/`, aud: AUD }));
		await expect(
			verifyAccessJwt(token, { team: `${TEAM}/`, aud: AUD }),
		).resolves.toBeDefined();
	});

	it("usa common_name cuando no hay correo (token de servicio)", async () => {
		const token = await forge.sign(
			claims({ email: undefined, common_name: "svc.access" }),
		);
		expect((await verifyAccessJwt(token, config)).email).toBe("svc.access");
	});

	it.each([
		["token sin exp", { exp: undefined }],
		["token vencido", { exp: Math.floor(Date.now() / 1000) - 10 }],
		["emisor de otro equipo", { iss: "https://otro.cloudflareaccess.com" }],
		["audiencia de otra aplicacion", { aud: ["b".repeat(64)] }],
		["sin correo", { email: undefined }],
		["nbf en el futuro", { nbf: Math.floor(Date.now() / 1000) + 3600 }],
	])("rechaza: %s", async (_name, over) => {
		const token = await forge.sign(claims(over as Record<string, unknown>));
		await expect(verifyAccessJwt(token, config)).rejects.toThrow();
	});

	it("rechaza un token firmado con otra llave", async () => {
		const other = await makeForge("llave-1"); // mismo kid, otra llave
		await expect(
			verifyAccessJwt(await other.sign(claims()), config),
		).rejects.toThrow();
	});

	it("rechaza un kid que Access no publica (tras recargar las llaves una vez)", async () => {
		const unknown = await makeForge("desconocida");
		const fetchMock = stubCerts(vi, [forge.publicJwk]);
		await expect(
			verifyAccessJwt(await unknown.sign(claims()), config),
		).rejects.toThrow();
		expect(fetchMock).toHaveBeenCalledTimes(2);
	});

	it("rechaza algoritmos distintos de RS256 (incluido none)", async () => {
		const none = `${btoa(JSON.stringify({ alg: "none" })).replace(/=+$/, "")}.e30.`;
		await expect(verifyAccessJwt(none, config)).rejects.toThrow();
		const hs = await forge.sign(claims(), { alg: "HS256" });
		await expect(verifyAccessJwt(hs, config)).rejects.toThrow();
	});

	it("rechaza un token mal formado", async () => {
		await expect(verifyAccessJwt("abc", config)).rejects.toThrow();
		await expect(verifyAccessJwt("a.b", config)).rejects.toThrow();
	});

	it("guarda las llaves en cache: una sola peticion para varios tokens", async () => {
		const fetchMock = stubCerts(vi, [forge.publicJwk]);
		await verifyAccessJwt(await forge.sign(claims()), config);
		await verifyAccessJwt(await forge.sign(claims()), config);
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});
});

describe("authenticate", () => {
	it("503 si falta la configuracion de Access (falla cerrado)", async () => {
		const res = await authenticate(headersWith(await forge.sign(claims())), {});
		expect(res).toMatchObject({ ok: false, status: 503 });
	});

	it("401 sin cabecera de Access", async () => {
		expect(await authenticate(headersWith(), config)).toMatchObject({
			ok: false,
			status: 401,
		});
	});

	it("401 con un token invalido, sin dar el motivo", async () => {
		const res = await authenticate(headersWith("x.y.z"), config);
		expect(res).toMatchObject({ ok: false, status: 401 });
		if (res.ok === false) expect(res.reason).not.toMatch(/firma|llave|exp/i);
	});

	it("deja pasar a un usuario valido", async () => {
		const res = await authenticate(
			headersWith(await forge.sign(claims())),
			config,
		);
		expect(res).toMatchObject({ ok: true, user: { email: "yo@ejemplo.dev" } });
	});

	it("403 si el correo no esta en la lista permitida (sin importar mayusculas)", async () => {
		const token = await forge.sign(claims({ email: "Intruso@ejemplo.dev" }));
		const denied = await authenticate(headersWith(token), {
			...config,
			allowedEmails: ["yo@ejemplo.dev"],
		});
		expect(denied).toMatchObject({ ok: false, status: 403 });
		const ok = await authenticate(
			headersWith(await forge.sign(claims({ email: "YO@Ejemplo.dev" }))),
			{
				...config,
				allowedEmails: ["yo@ejemplo.dev"],
			},
		);
		expect(ok.ok).toBe(true);
	});

	it("usuario falso SOLO con dev=true; en produccion sin JWT es 401, no 200", async () => {
		const dev = await authenticate(headersWith(), config, { dev: true });
		expect(dev).toMatchObject({ ok: true, user: { email: "dev@localhost" } });
		const prod = await authenticate(headersWith(), config, { dev: false });
		expect(prod).toMatchObject({ ok: false, status: 401 });
		const prodSinConfig = await authenticate(headersWith(), {}, { dev: false });
		expect(prodSinConfig).toMatchObject({ ok: false, status: 503 });
	});
});

describe("parseAllowedEmails", () => {
	it("separa por coma, recorta y pasa a minusculas", () => {
		expect(parseAllowedEmails(" A@x.com, b@Y.com ,,")).toEqual([
			"a@x.com",
			"b@y.com",
		]);
	});
	it("vacio o ausente = sin lista", () => {
		expect(parseAllowedEmails(undefined)).toEqual([]);
		expect(parseAllowedEmails("")).toEqual([]);
	});
});
