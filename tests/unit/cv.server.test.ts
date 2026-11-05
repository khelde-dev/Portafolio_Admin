import { describe, expect, it, vi } from "vitest";

vi.mock("astro:env/server", () => ({
	BACKEND_URL: "https://api.example.dev/api",
	API_SECRET_TOKEN: "tok-secreto-9f3a",
}));

const { BackendError } = await import("@/server/backendClient");
const { deleteCv, getCv, looksLikePdf, uploadCv } = await import(
	"@/server/cvProxy"
);

const SITE = "http://localhost";

const pdfBytes = (extra = 30) =>
	Uint8Array.from([
		...[..."%PDF-1.4\n"].map((c) => c.charCodeAt(0)),
		...new Array(extra).fill(0),
	]);

const upload = (
	options: {
		body?: BodyInit;
		type?: string;
		headers?: Record<string, string>;
	} = {},
) => {
	const request = new Request(`${SITE}/api/cv`, {
		method: "POST",
		headers: {
			"Content-Type": options.type ?? "application/pdf",
			...options.headers,
		},
		body: options.body ?? pdfBytes(),
	});
	return { request, url: new URL(request.url), params: {} };
};

const ok = (data: unknown = {}) =>
	vi.fn().mockResolvedValue({ success: true, data });

describe("looksLikePdf", () => {
	it("acepta la firma %PDF- y rechaza lo demas", () => {
		expect(looksLikePdf(pdfBytes())).toBe(true);
		expect(looksLikePdf(new TextEncoder().encode("<html>".repeat(5)))).toBe(
			false,
		);
		expect(looksLikePdf(new Uint8Array(0))).toBe(false);
		expect(looksLikePdf(Uint8Array.from([0x25, 0x50, 0x44, 0x46]))).toBe(false);
	});
});

describe("subida (/api/cv)", () => {
	it("reenvia el PDF en binario con su tipo y el JWT, y devuelve 201", async () => {
		const call = ok({ key: "cv/CV-Erick-Gonzalez-ab12cd34.pdf" });
		const res = await uploadCv(
			upload({ headers: { "Cf-Access-Jwt-Assertion": "jwt-1" } }),
			call,
		);
		expect(res.status).toBe(201);
		expect(await res.json()).toEqual({
			data: { key: "cv/CV-Erick-Gonzalez-ab12cd34.pdf" },
		});
		const [path, init] = call.mock.calls[0];
		expect(path).toBe("/cv");
		expect(init).toMatchObject({
			method: "POST",
			contentType: "application/pdf",
			accessJwt: "jwt-1",
			timeoutMs: 30_000,
		});
		expect(init.body).toBeInstanceOf(Uint8Array);
	});

	it.each([
		["otro origen", { headers: { Origin: "https://malo.example" } }, 403],
		["una imagen", { type: "image/webp" }, 415],
		["JSON", { type: "application/json" }, 415],
		["vacio", { body: new Uint8Array(0) }, 400],
		[
			"no es PDF",
			{
				body: new TextEncoder().encode("<svg onload=alert(1)></svg>".repeat(5)),
			},
			400,
		],
		["mas de 5 MB", { body: new Uint8Array(5 * 1024 * 1024 + 1) }, 413],
	] as const)(
		"rechaza %s (%i) sin llamar al backend",
		async (_n, options, status) => {
			const call = ok();
			const res = await uploadCv(upload(options as never), call);
			expect(res.status).toBe(status);
			expect(call).not.toHaveBeenCalled();
		},
	);

	it("un Content-Length declarado enorme se corta antes de leer", async () => {
		const call = ok();
		const res = await uploadCv(
			upload({ headers: { "Content-Length": String(6 * 1024 * 1024) } }),
			call,
		);
		expect(res.status).toBe(413);
		expect(call).not.toHaveBeenCalled();
	});

	it("sin textos del sitio (409 del backend) explica que hay que guardarlos primero", async () => {
		vi.spyOn(console, "error").mockImplementation(() => {});
		const res = await uploadCv(
			upload(),
			vi.fn().mockRejectedValue(new BackendError(409)),
		);
		expect(res.status).toBe(409);
		expect((await res.json()).message).toMatch(/Guarda primero los textos/);
	});

	it("un fallo de red no filtra el token", async () => {
		vi.spyOn(console, "error").mockImplementation(() => {});
		const res = await uploadCv(
			upload(),
			vi.fn().mockRejectedValue(new TypeError("Bearer tok-secreto-9f3a")),
		);
		expect(res.status).toBe(503);
		expect(await res.text()).not.toContain("tok-secreto-9f3a");
	});
});

describe("lectura y borrado", () => {
	const del = (headers: Record<string, string> = {}) => {
		const request = new Request(`${SITE}/api/cv`, {
			method: "DELETE",
			headers: { "Content-Type": "application/json", ...headers },
		});
		return { request, url: new URL(request.url), params: {} };
	};

	it("GET devuelve el PDF actual con el JWT", async () => {
		const call = ok({ key: "cv/a.pdf", url: null, size: 10, uploaded: null });
		const request = new Request(`${SITE}/api/cv`, {
			headers: { "Cf-Access-Jwt-Assertion": "j" },
		});
		const res = await getCv(
			{ request, url: new URL(request.url), params: {} },
			call,
		);
		expect(res.status).toBe(200);
		expect((await res.json()).data.key).toBe("cv/a.pdf");
		expect(call.mock.calls[0]).toEqual([
			"/cv",
			expect.objectContaining({ accessJwt: "j" }),
		]);
	});

	it("GET sin PDF devuelve data null", async () => {
		const res = await getCv(
			{
				request: new Request(`${SITE}/api/cv`),
				url: new URL(`${SITE}/api/cv`),
				params: {},
			},
			ok(null),
		);
		expect(await res.json()).toEqual({ data: null });
	});

	it("DELETE llama al backend con el JWT", async () => {
		const call = ok();
		const res = await deleteCv(del({ "Cf-Access-Jwt-Assertion": "j" }), call);
		expect(res.status).toBe(200);
		expect(call.mock.calls[0]).toEqual([
			"/cv",
			expect.objectContaining({ method: "DELETE", accessJwt: "j" }),
		]);
	});

	it("DELETE exige mismo origen y JSON (anti-CSRF)", async () => {
		const call = ok();
		const foreign = await deleteCv(
			del({ Origin: "https://malo.example" }),
			call,
		);
		expect(foreign.status).toBe(403);
		const noJson = await deleteCv(del({ "Content-Type": "text/plain" }), call);
		expect(noJson.status).toBe(415);
		expect(call).not.toHaveBeenCalled();
	});

	it("DELETE sin PDF cargado responde 404", async () => {
		vi.spyOn(console, "error").mockImplementation(() => {});
		const res = await deleteCv(
			del(),
			vi.fn().mockRejectedValue(new BackendError(404)),
		);
		expect(res.status).toBe(404);
	});
});
