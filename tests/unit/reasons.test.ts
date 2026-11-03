import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("astro:env/server", () => ({
	BACKEND_URL: "https://api.example.dev/api",
	API_SECRET_TOKEN: "test-token-value",
}));

const { BackendError, callBackend, classifyReason, rejectionMessage } =
	await import("@/server/backendClient");
const { describeFailure } = await import("@/server/data");
const { handleResource } = await import("@/server/proxy");
const { probeBackendAuth } = await import("@/server/status");

afterEach(() => vi.unstubAllGlobals());

const BACKEND_MESSAGES = {
	bearer: [
		"Invalid token",
		"No Authorization header",
		"Invalid Authorization header",
	],
	"access-missing": ["Falta la sesion de Cloudflare Access"],
	"access-invalid": ["Sesion de Access invalida"],
	"access-unconfigured": ["Cloudflare Access no esta configurado"],
} as const;

describe("classifyReason (solo mensajes fijos del backend)", () => {
	for (const [reason, messages] of Object.entries(BACKEND_MESSAGES)) {
		it.each(messages)(`"%s" -> ${reason}`, (message) => {
			expect(classifyReason({ success: false, message })).toBe(reason);
		});
	}

	it("texto libre, vacio o raro no se clasifica (no se copia nada del backend)", () => {
		for (const payload of [
			null,
			{},
			{ message: "otra cosa" },
			{ message: 7 },
			{ message: "__proto__" },
			"x",
		]) {
			expect(classifyReason(payload)).toBeNull();
		}
	});
});

describe("callBackend conserva el motivo", () => {
	const reply = (status: number, message: string) =>
		vi.stubGlobal(
			"fetch",
			vi
				.fn()
				.mockResolvedValue(
					Response.json({ success: false, message }, { status }),
				),
		);

	it("401 por token, 401 por Access, 503 sin configurar", async () => {
		reply(401, "Invalid token");
		expect(await callBackend("/x").catch((e) => e)).toMatchObject({
			status: 401,
			reason: "bearer",
		});
		reply(401, "Falta la sesion de Cloudflare Access");
		expect(await callBackend("/x").catch((e) => e)).toMatchObject({
			status: 401,
			reason: "access-missing",
		});
		reply(503, "Cloudflare Access no esta configurado");
		expect(await callBackend("/x").catch((e) => e)).toMatchObject({
			status: 503,
			reason: "access-unconfigured",
		});
	});

	it("el error no copia el texto del backend", async () => {
		reply(401, "Invalid token");
		const error = (await callBackend("/x").catch((e) => e)) as Error;
		expect(error.message).toBe("El backend respondio 401");
		expect(JSON.stringify(error)).not.toContain("Invalid token");
	});

	it("un 500 no lleva motivo", async () => {
		reply(500, "Invalid token");
		expect(
			(
				(await callBackend("/x").catch((e) => e)) as InstanceType<
					typeof BackendError
				>
			).reason,
		).toBeNull();
	});
});

describe("mensajes que dicen donde se arregla", () => {
	it("cada motivo apunta a su variable", () => {
		expect(rejectionMessage("bearer")).toMatch(/API_SECRET_TOKEN.*API_TOKEN/);
		expect(rejectionMessage("access-unconfigured")).toMatch(
			/ACCESS_AUD.*dev:access/,
		);
		expect(rejectionMessage("access-missing")).toMatch(/DEV_ACCESS_KEY/);
		expect(rejectionMessage("access-invalid")).toMatch(/dev:access/);
		expect(rejectionMessage(null)).toMatch(/Estado/);
	});

	it("nunca incluyen un valor, solo nombres de variables", () => {
		for (const reason of [
			"bearer",
			"access-missing",
			"access-invalid",
			"access-unconfigured",
			null,
		] as const) {
			expect(rejectionMessage(reason)).not.toMatch(/test-token-value|eyJ/);
		}
	});

	it("las paginas muestran el motivo concreto", () => {
		expect(describeFailure(new BackendError(401, [], [], "bearer"))).toMatch(
			/API_SECRET_TOKEN/,
		);
		expect(
			describeFailure(new BackendError(503, [], [], "access-unconfigured")),
		).toMatch(/ACCESS_AUD/);
		expect(describeFailure(new BackendError(403))).toMatch(/Estado/);
	});

	it("las rutas /api tambien: 502 con el motivo", async () => {
		const call = vi
			.fn()
			.mockRejectedValue(new BackendError(401, [], [], "bearer"));
		const res = await handleResource(
			{
				request: new Request("http://localhost/api/projects"),
				url: new URL("http://localhost/api/projects"),
				params: { resource: "projects" },
			},
			"list",
			call,
		);
		expect(res.status).toBe(502);
		expect(((await res.json()) as { message: string }).message).toMatch(
			/API_SECRET_TOKEN/,
		);
	});
});

describe("probeBackendAuth (la peticion real que usa Estado)", () => {
	const request = new Request("http://localhost/estado", {
		headers: { "Cf-Access-Jwt-Assertion": "jwt-1" },
	});

	it("ok cuando el backend acepta; manda el JWT de la peticion", async () => {
		const call = vi.fn().mockResolvedValue({ data: { unread: 0 } });
		expect(await probeBackendAuth(request, call)).toEqual({
			ok: true,
			status: null,
			reason: null,
			hint: "",
		});
		expect(call).toHaveBeenCalledWith(
			"/contact-messages/unread-count",
			expect.objectContaining({ accessJwt: "jwt-1", timeoutMs: 4000 }),
		);
	});

	it("rechazo por token o por Access: dice cual", async () => {
		const bearer = await probeBackendAuth(
			request,
			vi.fn().mockRejectedValue(new BackendError(401, [], [], "bearer")),
		);
		expect(bearer).toMatchObject({ ok: false, status: 401, reason: "bearer" });
		expect(bearer.hint).toMatch(/API_TOKEN/);
		const access = await probeBackendAuth(
			request,
			vi
				.fn()
				.mockRejectedValue(
					new BackendError(503, [], [], "access-unconfigured"),
				),
		);
		expect(access.hint).toMatch(/ACCESS_AUD/);
	});

	it("otros estados y la falta de respuesta tambien se explican", async () => {
		expect(
			(
				await probeBackendAuth(
					request,
					vi.fn().mockRejectedValue(new BackendError(500)),
				)
			).hint,
		).toMatch(/500/);
		expect(
			(
				await probeBackendAuth(
					request,
					vi.fn().mockRejectedValue(new TypeError("x")),
				)
			).hint,
		).toMatch(/No hubo respuesta/);
	});
});

describe("edicion simultanea (409 por version)", () => {
	const STALE =
		"Este elemento cambió desde que lo abriste. Recarga para ver la versión nueva.";

	it("el motivo se conserva en un 409, y un 409 de otro tipo no lo tiene", async () => {
		vi.stubGlobal(
			"fetch",
			vi
				.fn()
				.mockResolvedValue(
					Response.json({ success: false, message: STALE }, { status: 409 }),
				),
		);
		const stale = (await callBackend("/x").catch((e) => e)) as InstanceType<
			typeof BackendError
		>;
		expect(stale.status).toBe(409);
		expect(stale.reason).toBe("stale");

		vi.stubGlobal(
			"fetch",
			vi
				.fn()
				.mockResolvedValue(
					Response.json(
						{ success: false, message: "slug repetido" },
						{ status: 409 },
					),
				),
		);
		const other = (await callBackend("/x").catch((e) => e)) as InstanceType<
			typeof BackendError
		>;
		expect(other.reason).toBeNull();
	});

	it("el proxy responde 409 con stale: true y sin confundirlo con un valor repetido", async () => {
		const call = vi
			.fn()
			.mockRejectedValue(new BackendError(409, [], [], "stale"));
		const res = await handleResource(
			{
				request: new Request("http://localhost/api/projects/3", {
					method: "PUT",
					headers: {
						"Content-Type": "application/json",
						Origin: "http://localhost",
					},
					body: JSON.stringify({
						slug: "a",
						category: "frontend",
						title_default: "t",
						summary_default: "s",
						description_default: "d",
						card_image: "a.webp",
						updated_at: "2026-01-01 10:00:00",
					}),
				}),
				url: new URL("http://localhost/api/projects/3"),
				params: { resource: "projects", id: "3" },
			},
			"update",
			call,
		);
		expect(res.status).toBe(409);
		const body = (await res.json()) as { message: string; stale?: boolean };
		expect(body.stale).toBe(true);
		expect(body.message).toMatch(/cambió desde que lo abriste/);
		// La version leida viaja al backend dentro del cuerpo.
		expect(call.mock.calls[0][1].body).toMatchObject({
			updated_at: "2026-01-01 10:00:00",
		});
	});
});
