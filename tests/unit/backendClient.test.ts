import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("astro:env/server", () => ({
	BACKEND_URL: "https://api.example.dev/api/",
	API_SECRET_TOKEN: "test-token-value",
}));

const { BackendError, buildBackendUrl, callBackend } = await import(
	"@/server/backendClient"
);

afterEach(() => vi.unstubAllGlobals());

const stubFetch = (response: Response) => {
	const fetchMock = vi
		.fn()
		.mockImplementation(() => Promise.resolve(response.clone()));
	vi.stubGlobal("fetch", fetchMock);
	return fetchMock;
};

describe("buildBackendUrl", () => {
	it("une la base y la ruta sin duplicar barras", () => {
		expect(buildBackendUrl("/projects/3")).toBe(
			"https://api.example.dev/api/projects/3",
		);
	});

	it("rechaza rutas sin / inicial, con // inicial o con ..", () => {
		expect(() => buildBackendUrl("projects")).toThrow();
		expect(() => buildBackendUrl("//evil.example/x")).toThrow();
		expect(() => buildBackendUrl("/projects/../admin")).toThrow();
	});
});

describe("buildBackendUrl (consulta)", () => {
	it("un .. dentro de la consulta no es un segmento de la ruta", () => {
		expect(() => buildBackendUrl("/projects?q=..")).not.toThrow();
	});
});

describe("callBackend", () => {
	it("manda el bearer y reenvia el JWT de Access", async () => {
		const fetchMock = stubFetch(Response.json({ success: true }));
		await callBackend("/projects", { accessJwt: "jwt-de-access" });
		const [url, init] = fetchMock.mock.calls[0];
		expect(url).toBe("https://api.example.dev/api/projects");
		expect(init.headers.Authorization).toBe("Bearer test-token-value");
		expect(init.headers["Cf-Access-Jwt-Assertion"]).toBe("jwt-de-access");
		expect(init.method).toBe("GET");
	});

	it("no manda el JWT si no hay uno", async () => {
		const fetchMock = stubFetch(Response.json({}));
		await callBackend("/projects");
		expect(fetchMock.mock.calls[0][1].headers).not.toHaveProperty(
			"Cf-Access-Jwt-Assertion",
		);
	});

	it("serializa el cuerpo como JSON", async () => {
		const fetchMock = stubFetch(Response.json({}));
		await callBackend("/projects", { method: "POST", body: { title: "x" } });
		const init = fetchMock.mock.calls[0][1];
		expect(init.headers["Content-Type"]).toBe("application/json");
		expect(init.body).toBe('{"title":"x"}');
	});

	it("devuelve el JSON de la respuesta", async () => {
		stubFetch(Response.json({ data: [1, 2] }));
		expect(await callBackend("/projects")).toEqual({ data: [1, 2] });
	});

	it("toda escritura lleva Content-Type, incluso un DELETE sin cuerpo", async () => {
		const fetchMock = stubFetch(Response.json({ success: true }));
		await callBackend("/projects/3", { method: "DELETE" });
		expect(fetchMock.mock.calls[0][1].headers["Content-Type"]).toBe(
			"application/json",
		);
		await callBackend("/projects/3", { method: "PUT", body: { a: 1 } });
		expect(fetchMock.mock.calls[1][1].headers["Content-Type"]).toBe(
			"application/json",
		);
	});

	it("un GET no manda Content-Type", async () => {
		const fetchMock = stubFetch(Response.json({}));
		await callBackend("/projects");
		expect(fetchMock.mock.calls[0][1].headers).not.toHaveProperty(
			"Content-Type",
		);
	});

	it("manda bytes tal cual cuando se indica el tipo (subida de imagen)", async () => {
		const fetchMock = stubFetch(Response.json({ key: "a.webp" }));
		const bytes = new Uint8Array([1, 2, 3]);
		await callBackend("/media", {
			method: "POST",
			body: bytes,
			contentType: "image/webp",
		});
		const init = fetchMock.mock.calls[0][1];
		expect(init.headers["Content-Type"]).toBe("image/webp");
		expect(init.body).toBe(bytes);
	});

	it("una respuesta sin cuerpo (204) no es un fallo", async () => {
		stubFetch(new Response(null, { status: 204 }));
		expect(
			await callBackend("/projects/3", { method: "DELETE" }),
		).toBeUndefined();
	});

	it("un 400 conserva solo ruta y mensaje de cada aviso, nada mas", async () => {
		stubFetch(
			Response.json(
				{
					success: false,
					message: "Datos invalidos",
					errors: [
						{
							path: ["slug"],
							message: "Slug invalido",
							code: "x",
							secreto: "no",
						},
						{ path: ["translations", 1, "title"], message: "Requerido" },
						{ message: "sin ruta" },
					],
					stack: "interno",
				},
				{ status: 400 },
			),
		);
		const error = (await callBackend("/projects", {
			method: "POST",
			body: {},
		}).catch((e) => e)) as InstanceType<typeof BackendError>;
		expect(error.status).toBe(400);
		expect(error.issues).toEqual([
			{ path: ["slug"], message: "Slug invalido" },
			{ path: ["translations", 1, "title"], message: "Requerido" },
		]);
		expect(JSON.stringify(error)).not.toContain("interno");
	});

	it("un error trae solo el estado, nunca el cuerpo del backend", async () => {
		stubFetch(new Response("secreto-interno", { status: 500 }));
		const error = (await callBackend("/projects").catch(
			(e) => e,
		)) as InstanceType<typeof BackendError>;
		expect(error).toBeInstanceOf(BackendError);
		expect(error.status).toBe(500);
		expect(error.message).not.toContain("secreto-interno");
		expect(error.message).not.toContain("test-token-value");
	});
});
