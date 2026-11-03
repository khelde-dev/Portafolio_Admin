import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearAccessKeyCache } from "@/server/access";
import { AUD, claims, makeForge, stubCerts, TEAM } from "../support/forge";

const env = vi.hoisted(() => ({
	ACCESS_AUD: "",
	ACCESS_TEAM_DOMAIN: "",
	ADMIN_EMAILS: undefined as string | undefined,
}));
vi.mock("astro:env/server", () => env);
vi.mock("astro:middleware", () => ({ defineMiddleware: <T>(fn: T) => fn }));

const { onRequest } = await import("@/middleware");

type Ctx = { url: URL; request: Request; locals: Record<string, unknown> };
const call = (path: string, headers: Record<string, string> = {}) => {
	const ctx: Ctx = {
		url: new URL(`http://localhost${path}`),
		request: new Request(`http://localhost${path}`, { headers }),
		locals: {},
	};
	const next = vi.fn().mockResolvedValue(new Response("pagina"));
	return (onRequest as unknown as (c: Ctx, n: unknown) => Promise<Response>)(
		ctx,
		next,
	).then((response) => ({ response, ctx, next }));
};

let forge: Awaited<ReturnType<typeof makeForge>>;
beforeEach(async () => {
	clearAccessKeyCache();
	forge = await makeForge();
	stubCerts(vi, [forge.publicJwk]);
	vi.stubEnv("DEV", false);
	env.ACCESS_AUD = AUD;
	env.ACCESS_TEAM_DOMAIN = TEAM;
	env.ADMIN_EMAILS = undefined;
});
afterEach(() => {
	vi.unstubAllGlobals();
	vi.unstubAllEnvs();
});

describe("middleware de identidad (produccion)", () => {
	it("sin JWT: 401, no se llama a la pagina y no se sirve HTML del panel", async () => {
		const { response, next } = await call("/");
		expect(response.status).toBe(401);
		expect(next).not.toHaveBeenCalled();
		expect(await response.text()).not.toContain("pagina");
	});

	it("en /api/* el rechazo es JSON generico", async () => {
		const { response } = await call("/api/projects");
		expect(response.status).toBe(401);
		expect(response.headers.get("Content-Type")).toContain("application/json");
		expect(await response.json()).toEqual({
			message: expect.stringContaining("Cloudflare Access"),
		});
	});

	it("sin configuracion de Access: 503, nunca 200", async () => {
		env.ACCESS_AUD = "";
		const token = await forge.sign(claims());
		const { response } = await call("/", { "Cf-Access-Jwt-Assertion": token });
		expect(response.status).toBe(503);
	});

	it("con un JWT valido deja pasar y pone el usuario en locals", async () => {
		const token = await forge.sign(claims());
		const { response, ctx, next } = await call("/cuenta", {
			"Cf-Access-Jwt-Assertion": token,
		});
		expect(response.status).toBe(200);
		expect(next).toHaveBeenCalled();
		expect(ctx.locals.user).toMatchObject({ email: "yo@ejemplo.dev" });
	});

	it("403 con un correo fuera de ADMIN_EMAILS", async () => {
		env.ADMIN_EMAILS = "otro@ejemplo.dev";
		const token = await forge.sign(claims());
		const { response } = await call("/", { "Cf-Access-Jwt-Assertion": token });
		expect(response.status).toBe(403);
	});

	it("las respuestas rechazadas tambien llevan las cabeceras de seguridad", async () => {
		const { response } = await call("/");
		expect(response.headers.get("X-Frame-Options")).toBe("DENY");
		expect(response.headers.get("X-Robots-Tag")).toBe("noindex, nofollow");
	});

	it("el rechazo no revela por que (firma, llave, exp…)", async () => {
		const { response } = await call("/api/x", {
			"Cf-Access-Jwt-Assertion": "a.b.c",
		});
		const body = JSON.stringify(await response.json());
		expect(body).not.toMatch(/firma|llave|exp|kid|signature/i);
	});
});

describe("middleware de identidad (desarrollo)", () => {
	it("en dev entra con el usuario falso aunque no haya JWT", async () => {
		vi.stubEnv("DEV", true);
		const { response, ctx } = await call("/");
		expect(response.status).toBe(200);
		expect(ctx.locals.user).toMatchObject({ email: "dev@localhost" });
	});
});
