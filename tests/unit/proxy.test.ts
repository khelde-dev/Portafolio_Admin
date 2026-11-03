import { describe, expect, it, vi } from "vitest";

vi.mock("astro:env/server", () => ({
	BACKEND_URL: "https://api.example.dev/api",
	API_SECRET_TOKEN: "tok-secreto-9f3a",
}));

const { BackendError } = await import("@/server/backendClient");
const { handleResource } = await import("@/server/proxy");
const { RESOURCES, findResource } = await import("@/server/resources");

const SITE = "http://localhost";
const JSON_HEADERS = { "Content-Type": "application/json" };

const project = {
	slug: "mi-proyecto",
	category: "frontend",
	card_image: "projects/a.webp",
	title_default: "Mi proyecto",
	summary_default: "Resumen",
	description_default: "Descripción",
};

const ctx = (
	method: string,
	resource: string | undefined,
	options: {
		id?: string;
		body?: unknown;
		headers?: Record<string, string>;
		search?: string;
	} = {},
) => ({
	request: new Request(
		`${SITE}/api/${resource}${options.id ? `/${options.id}` : ""}${options.search ?? ""}`,
		{
			method,
			headers: {
				...(method === "GET" ? {} : JSON_HEADERS),
				...options.headers,
			},
			body:
				options.body === undefined ? undefined : JSON.stringify(options.body),
		},
	),
	url: new URL(`${SITE}/api/${resource}${options.search ?? ""}`),
	params: { resource, id: options.id },
});

const ok = (data: unknown = []) =>
	vi.fn().mockResolvedValue({ success: true, data });

describe("lista blanca de recursos", () => {
	it("un recurso desconocido es 404 y nunca llama al backend", async () => {
		const call = ok();
		for (const name of [
			"users",
			"__proto__",
			"constructor",
			"../etc",
			undefined,
		]) {
			const res = await handleResource(
				ctx("GET", name as string),
				"list",
				call,
			);
			expect(res.status).toBe(404);
		}
		expect(call).not.toHaveBeenCalled();
	});

	it("findResource no se deja engañar por claves del prototipo", () => {
		expect(findResource("toString")).toBeUndefined();
		expect(findResource("projects")).toBe(RESOURCES.projects);
	});

	it.each([
		["comments", "create"],
		["comments", "remove"],
		["contact-messages", "create"],
		["about", "create"],
		["about", "remove"],
		["about", "order"],
		["comments", "order"],
	] as const)("%s no permite %s (405)", async (resource, op) => {
		const call = ok();
		const res = await handleResource(
			ctx(op === "remove" ? "DELETE" : "POST", resource, { id: "1", body: {} }),
			op,
			call,
		);
		expect(res.status).toBe(405);
		expect(call).not.toHaveBeenCalled();
	});
});

describe("lectura", () => {
	it("lista con el camino del backend y entrega { data }", async () => {
		const call = ok([{ project_id: 1 }]);
		const res = await handleResource(ctx("GET", "projects"), "list", call);
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({ data: [{ project_id: 1 }] });
		expect(call).toHaveBeenCalledWith(
			"/projects/admin",
			expect.objectContaining({ method: "GET" }),
		);
	});

	it("reenvia el JWT de Access de la peticion", async () => {
		const call = ok();
		await handleResource(
			ctx("GET", "projects", {
				headers: { "Cf-Access-Jwt-Assertion": "jwt-abc" },
			}),
			"list",
			call,
		);
		expect(call.mock.calls[0][1].accessJwt).toBe("jwt-abc");
	});

	it("el filtro de la bandeja se valida y se reenvia", async () => {
		const call = ok();
		await handleResource(
			ctx("GET", "contact-messages", { search: "?status=unread" }),
			"list",
			call,
		);
		expect(call.mock.calls[0][0]).toBe("/contact-messages?status=unread");
		const bad = await handleResource(
			ctx("GET", "contact-messages", { search: "?status=x" }),
			"list",
			call,
		);
		expect(bad.status).toBe(400);
		expect(call).toHaveBeenCalledTimes(1);
	});

	it("parametros de consulta desconocidos no llegan al backend", async () => {
		const call = ok();
		await handleResource(
			ctx("GET", "contact-messages", { search: "?status=read&admin=1&x=../" }),
			"list",
			call,
		);
		expect(call.mock.calls[0][0]).toBe("/contact-messages?status=read");
	});
});

describe("escritura: CSRF y tamano", () => {
	it("rechaza otro origen (403) sin llamar al backend", async () => {
		const call = ok();
		const res = await handleResource(
			ctx("POST", "projects", {
				body: project,
				headers: { Origin: "https://malo.example" },
			}),
			"create",
			call,
		);
		expect(res.status).toBe(403);
		expect(call).not.toHaveBeenCalled();
	});

	it("acepta el mismo origen", async () => {
		const call = ok({});
		const res = await handleResource(
			ctx("POST", "projects", { body: project, headers: { Origin: SITE } }),
			"create",
			call,
		);
		expect(res.status).toBe(201);
	});

	it("exige application/json, tambien en DELETE sin cuerpo", async () => {
		const call = ok();
		const form = new Request(`${SITE}/api/projects`, {
			method: "POST",
			headers: { "Content-Type": "text/plain" },
			body: JSON.stringify(project),
		});
		const res = await handleResource(
			{
				request: form,
				url: new URL(form.url),
				params: { resource: "projects" },
			},
			"create",
			call,
		);
		expect(res.status).toBe(415);

		const del = new Request(`${SITE}/api/projects/3`, { method: "DELETE" });
		const res2 = await handleResource(
			{
				request: del,
				url: new URL(del.url),
				params: { resource: "projects", id: "3" },
			},
			"remove",
			call,
		);
		expect(res2.status).toBe(415);
		expect(call).not.toHaveBeenCalled();
	});

	it("un cuerpo enorme es 413 y un JSON roto es 400", async () => {
		const call = ok();
		const big = await handleResource(
			ctx("POST", "projects", {
				body: { ...project, description_default: "x".repeat(70 * 1024) },
			}),
			"create",
			call,
		);
		expect(big.status).toBe(413);
		const broken = new Request(`${SITE}/api/projects`, {
			method: "POST",
			headers: JSON_HEADERS,
			body: "{no es json",
		});
		const res = await handleResource(
			{
				request: broken,
				url: new URL(broken.url),
				params: { resource: "projects" },
			},
			"create",
			call,
		);
		expect(res.status).toBe(400);
		expect(call).not.toHaveBeenCalled();
	});
});

describe("escritura: validacion e identificadores", () => {
	it("datos invalidos: 400 con errores por campo y sin tocar el backend", async () => {
		const call = ok();
		const res = await handleResource(
			ctx("POST", "projects", {
				body: { ...project, slug: "Mal Slug", link_web: "javascript:alert(1)" },
			}),
			"create",
			call,
		);
		expect(res.status).toBe(400);
		const body = (await res.json()) as {
			errors: { path: unknown[]; message: string }[];
		};
		expect(body.errors.map((e) => e.path[0]).sort()).toEqual([
			"link_web",
			"slug",
		]);
		expect(call).not.toHaveBeenCalled();
	});

	it("solo se reenvian los campos conocidos (nada de rol, id o created_at)", async () => {
		const call = ok({});
		await handleResource(
			ctx("POST", "projects", {
				body: { ...project, project_id: 99, created_at: "x", rol: "admin" },
			}),
			"create",
			call,
		);
		const sent = call.mock.calls[0][1].body as Record<string, unknown>;
		expect(sent).not.toHaveProperty("project_id");
		expect(sent).not.toHaveProperty("created_at");
		expect(sent).not.toHaveProperty("rol");
		expect(sent.slug).toBe("mi-proyecto");
	});

	it("las traducciones salen como lista, sin campos vacios", async () => {
		const call = ok({});
		await handleResource(
			ctx("POST", "projects", {
				body: {
					...project,
					translations: { en: { title: "Hi", summary: "" } },
				},
			}),
			"create",
			call,
		);
		expect(
			(call.mock.calls[0][1].body as { translations: unknown }).translations,
		).toEqual([{ locale: "en", title: "Hi" }]);
	});

	it.each([
		"abc",
		"0",
		"-1",
		"1e3",
		"0x10",
		"",
		"../x",
		"1;DROP",
		"9".repeat(20),
	])("id no valido %j: 400 y sin backend", async (id) => {
		const call = ok();
		const upd = await handleResource(
			ctx("PUT", "projects", { id, body: project }),
			"update",
			call,
		);
		const del = await handleResource(
			ctx("DELETE", "projects", { id }),
			"remove",
			call,
		);
		expect(upd.status).toBe(400);
		expect(del.status).toBe(400);
		expect(call).not.toHaveBeenCalled();
	});

	it("PUT con id apunta a /<recurso>/<id>; el singleton, sin id", async () => {
		const call = ok({});
		await handleResource(
			ctx("PUT", "projects", { id: "7", body: project }),
			"update",
			call,
		);
		expect(call.mock.calls[0][0]).toBe("/projects/7");
		await handleResource(
			ctx("PUT", "about", {
				body: {
					image: "about/a.webp",
					title_card_default: "Hola",
					subtitle_default: "Soy",
					description_default: "Dev",
				},
			}),
			"update",
			call,
		);
		expect(call.mock.calls[1][0]).toBe("/about");
	});

	it("comentarios: solo el estado, nada mas", async () => {
		const call = ok({});
		await handleResource(
			ctx("PUT", "comments", {
				id: "4",
				body: { status: "published", description: "editado" },
			}),
			"update",
			call,
		);
		expect(call.mock.calls[0][1].body).toEqual({ status: "published" });
	});

	it("DELETE llama al backend con el id", async () => {
		const call = ok({});
		const res = await handleResource(
			ctx("DELETE", "contact-messages", { id: "5" }),
			"remove",
			call,
		);
		expect(res.status).toBe(200);
		expect(call.mock.calls[0]).toEqual([
			"/contact-messages/5",
			expect.objectContaining({ method: "DELETE" }),
		]);
	});

	it("reordenar: valida la lista y usa /order", async () => {
		const call = ok([]);
		const res = await handleResource(
			ctx("PUT", "skills", {
				body: [
					{ id: 2, sort_order: 0 },
					{ id: 1, sort_order: 1 },
				],
			}),
			"order",
			call,
		);
		expect(res.status).toBe(200);
		expect(call.mock.calls[0][0]).toBe("/skills/order");
		const bad = await handleResource(
			ctx("PUT", "skills", { body: [] }),
			"order",
			call,
		);
		expect(bad.status).toBe(400);
	});
});

describe("errores del backend", () => {
	const failWith = (
		status: number,
		issues: { path: (string | number)[]; message: string }[] = [],
	) => vi.fn().mockRejectedValue(new BackendError(status, issues));

	it("400 conserva los avisos por campo", async () => {
		const res = await handleResource(
			ctx("POST", "projects", { body: project }),
			"create",
			failWith(400, [{ path: ["slug"], message: "Slug invalido" }]),
		);
		expect(res.status).toBe(400);
		expect((await res.json()) as unknown).toMatchObject({
			errors: [{ path: ["slug"], message: "Slug invalido" }],
		});
	});

	it("409 en proyectos marca el campo slug", async () => {
		const res = await handleResource(
			ctx("POST", "projects", { body: project }),
			"create",
			failWith(409),
		);
		expect(res.status).toBe(409);
		expect((await res.json()) as unknown).toMatchObject({
			errors: [{ path: ["slug"] }],
		});
	});

	it("404 -> 404; 401/403/503 del backend -> 502 de configuracion", async () => {
		expect(
			(
				await handleResource(
					ctx("DELETE", "projects", { id: "1" }),
					"remove",
					failWith(404),
				)
			).status,
		).toBe(404);
		for (const status of [401, 403, 503]) {
			const res = await handleResource(
				ctx("GET", "projects"),
				"list",
				failWith(status),
			);
			expect(res.status).toBe(502);
		}
		expect(
			(await handleResource(ctx("GET", "projects"), "list", failWith(500)))
				.status,
		).toBe(502);
	});

	it("un fallo de red es 503 y no revela nada", async () => {
		const call = vi
			.fn()
			.mockRejectedValue(
				new TypeError("fetch failed: Bearer tok-secreto-9f3a"),
			);
		const res = await handleResource(ctx("GET", "projects"), "list", call);
		expect(res.status).toBe(503);
		expect(await res.text()).not.toContain("tok-secreto-9f3a");
	});

	it("ningun error devuelve ni registra el token", async () => {
		const spy = vi.spyOn(console, "error").mockImplementation(() => {});
		await handleResource(
			ctx("GET", "projects"),
			"list",
			vi.fn().mockRejectedValue(new Error("Bearer tok-secreto-9f3a")),
		);
		const logged = JSON.stringify(spy.mock.calls);
		expect(logged).not.toContain("tok-secreto-9f3a");
		spy.mockRestore();
	});
});
